import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { isNative } from '../native/push'
import { useAuth } from './AuthContext'
import { refreshWebPush } from '../native/webpush'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const SocketContext = createContext(null)

// Bunyi notifikasi singkat via Web Audio (tanpa file aset)
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32)
    o.start()
    o.stop(ctx.currentTime + 0.34)
    o.onended = () => ctx.close()
  } catch {}
}

function activeChatId() {
  const p = window.location.pathname
  return p.startsWith('/chat/') ? p.slice('/chat/'.length).split('/')[0] : null
}

const HB_EVERY_MS = 15000      // cek detak koneksi
const HB_TIMEOUT_MS = 8000     // tanpa balasan sekian -> koneksi dianggap mati
const POLL_MS = 20000          // sinkron cadangan selama socket terputus
const BANNER_AFTER_MS = 4000   // pita "Menyambung ulang…" setelah putus sekian

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const userRef = useRef(user)
  userRef.current = user
  const [socket, setSocket] = useState(null)
  const [waConnected, setWaConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketError, setSocketError] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [newMessages, setNewMessages] = useState([])
  const [statusUpdates, setStatusUpdates] = useState([])
  const [messageUpdates, setMessageUpdates] = useState([])
  const [assignmentUpdates, setAssignmentUpdates] = useState([])
  const [conversationUpdates, setConversationUpdates] = useState([])
  const [deletedMessages, setDeletedMessages] = useState([])
  // Naik setiap kali perlu sinkron ulang (tersambung lagi, tab aktif lagi,
  // polling saat terputus, push yang terlewat socket) -> halaman ambil ulang data.
  const [resyncTick, setResyncTick] = useState(0)
  const [showReconnecting, setShowReconnecting] = useState(false)
  const socketRef = useRef(null)
  const seenMsgIds = useRef(new Set())        // pesan yang sudah diterima lewat socket
  const notifiedMsgIds = useRef(new Set())    // pesan yang sudah dinotifikasi (cegah dobel)
  const pendingUnassigned = useRef(new Map()) // convId -> data pesan masuk yang belum ber-agent
  const baseTitleRef = useRef('RenusPro Chat')

  // Minta izin notifikasi browser sekali di awal
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const restore = () => { document.title = baseTitleRef.current }
    window.addEventListener('focus', restore)
    return () => window.removeEventListener('focus', restore)
  }, [])

  // Tampilkan notifikasi (suara + browser + judul tab) saat ada pesan masuk baru
  // Agent hanya untuk chat yang di-assign ke dirinya (sama seperti push); admin semua.
  const isMine = (assignedTo) => {
    const u = userRef.current
    if (!u) return false
    if (u.role === 'admin') return true
    return !!assignedTo && String(assignedTo) === String(u.id)
  }

  const notifyNewMessage = (data) => {
    const msg = data?.message
    if (!msg || msg.from_me) return // hanya pesan masuk dari customer
    const convId = String(data.conversationId ?? msg.conversation_id ?? '')
    if (msg.id != null) {
      const key = String(msg.id)
      if (notifiedMsgIds.current.has(key)) return
      notifiedMsgIds.current.add(key)
      if (notifiedMsgIds.current.size > 500) notifiedMsgIds.current = new Set([...notifiedMsgIds.current].slice(-200))
    }
    const viewingThisChat = activeChatId() && String(activeChatId()) === convId && document.visibilityState === 'visible'
    if (viewingThisChat) return // sedang dibuka & fokus, tak perlu diganggu

    playBeep()

    // Di aplikasi native, notifikasi ditangani FCM (tray) — hindari notifikasi dobel.
    if (isNative()) return

    if (document.visibilityState !== 'visible') {
      // App di background/tertutup → notifikasi tray ditangani Web Push (service worker).
      document.title = `🔔 Pesan baru • ${baseTitleRef.current}`
      return
    }

    // App sedang dibuka & fokus → tampilkan notifikasi in-app (web push di-skip oleh SW).
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = data.contactName || 'Pesan baru'
        const body = msg.body || 'Pesan baru masuk'
        const n = new Notification(title, { body, tag: `conv-${convId}`, renotify: true })
        n.onclick = () => {
          window.focus()
          if (convId) window.location.assign(`/chat/${convId}`)
          n.close()
        }
      } catch {}
    }
  }

  useEffect(() => {
    const s = io(BACKEND_URL, {
      // Token login: server memasukkan socket ke room admin / agent sehingga
      // hanya menerima event chat yang berhak (fungsi -> token terbaru tiap sambung ulang)
      auth: (cb) => { let token = ''; try { token = localStorage.getItem('wa_token') || '' } catch {} cb({ token }) },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // jangan pernah menyerah (dulu berhenti setelah 10x)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      withCredentials: false,
      timeout: 10000,
    })

    socketRef.current = s
    setSocket(s)

    const resync = () => setResyncTick(t => t + 1)
    let everConnected = false
    let downSince = null
    let bannerTimer = null
    let pollTimer = null
    const markDown = () => {
      if (downSince) return
      downSince = Date.now()
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => setShowReconnecting(true), BANNER_AFTER_MS)
      clearInterval(pollTimer)
      pollTimer = setInterval(resync, POLL_MS) // cadangan selama terputus
    }
    const markUp = () => {
      clearTimeout(bannerTimer); clearInterval(pollTimer)
      setShowReconnecting(false)
      downSince = null
    }

    s.on('connect', () => {
      setSocketConnected(true)
      setSocketError(null)
      markUp()
      if (everConnected) resync() // ambil pesan yang terlewat selama terputus
      everConnected = true
    })
    s.on('connect_error', (err) => {
      setSocketConnected(false)
      setSocketError(err.message || 'Connection error')
      markDown()
    })
    s.on('disconnect', (reason) => {
      setSocketConnected(false)
      markDown()
      // Diputus server (mis. deploy) -> socket.io tidak menyambung otomatis
      if (reason === 'io server disconnect') s.connect()
    })
    s.io.on('reconnect', () => setSocketError(null))

    // Heartbeat: koneksi "zombie" (terlihat tersambung tapi mati, mis. setelah
    // laptop sleep / ganti jaringan) dipaksa tersambung ulang.
    let hbFails = 0
    const hb = setInterval(() => {
      if (!s.connected) { if (navigator.onLine !== false) s.connect(); return }
      if (document.visibilityState !== 'visible') return
      s.timeout(HB_TIMEOUT_MS).emit('hb', (err) => {
        if (!err) { hbFails = 0; return }
        if (++hbFails >= 2) { hbFails = 0; s.disconnect(); s.connect() }
      })
    }, HB_EVERY_MS)

    // Tab aktif lagi / jendela fokus / internet kembali -> pastikan tersambung & sinkron
    let lastWake = 0
    const wake = () => {
      if (document.visibilityState !== 'visible') return
      if (!s.connected) s.connect()
      if (Date.now() - lastWake > 5000) { lastWake = Date.now(); resync(); refreshWebPush() }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)

    s.on('wa_sync', (data) => setSyncing(!!data?.syncing))
    s.on('qr', (data) => { setQrCode(data); setWaConnected(false) })
    s.on('wa_status', (data) => {
      const connected = data === true || data?.connected === true
      setWaConnected(connected)
      if (connected) setQrCode(null)
    })
    s.on('new_message', (data) => {
      const msg = data?.message
      if (msg?.id != null) {
        seenMsgIds.current.add(String(msg.id))
        if (seenMsgIds.current.size > 1000) seenMsgIds.current = new Set([...seenMsgIds.current].slice(-300))
      }
      setNewMessages(prev => [...prev.slice(-99), data])
      if (!msg || msg.from_me) return
      const convId = String(data.conversationId ?? msg.conversation_id ?? '')
      if (isMine(data.assignedTo)) notifyNewMessage(data)
      else if (!data.assignedTo) {
        // Belum ada agent: tunggu auto-assign; bila jatuh ke agent ini, baru dinotifikasi
        pendingUnassigned.current.set(convId, { data, at: Date.now() })
      }
    })
    s.on('message_status', (data) => setStatusUpdates(prev => [...prev.slice(-99), data]))
    // Update field pesan yang menyusul (mis. media_url selesai diunggah) — tanpa notifikasi
    s.on('message_updated', (data) => setMessageUpdates(prev => [...prev.slice(-99), data]))
    // Chat ter-assign otomatis (auto-assign) — update badge agent realtime
    s.on('conversation_assigned', (data) => {
      setAssignmentUpdates(prev => [...prev.slice(-99), data])
      const convId = String(data?.conversationId ?? '')
      const pending = pendingUnassigned.current.get(convId)
      pendingUnassigned.current.delete(convId)
      if (pending && Date.now() - pending.at < 120000 && data?.agent && isMine(data.agent.id)) {
        notifyNewMessage({ ...pending.data, assignedTo: data.agent.id })
      } else if (data?.agent && userRef.current?.role !== 'admin' && isMine(data.agent.id) && data.lastFromMe === false) {
        // Agent hanya menerima event chat miliknya: chat baru/dipindahkan ke agent ini
        // diberi tahu dari event assign (berisi nama kontak & pesan terakhir).
        notifyNewMessage({
          conversationId: convId, contactName: data.contactName, assignedTo: data.agent.id,
          message: { id: `assign-${convId}-${Date.now()}`, body: data.lastMessage || 'Chat baru untuk Anda', from_me: false, conversation_id: convId },
        })
      }
    })
    // Regional / status bot lokasi berubah — update badge regional realtime
    s.on('conversation_updated', (data) => setConversationUpdates(prev => [...prev.slice(-99), data]))
    // Pesan dihapus — hilangkan dari daftar secara realtime
    s.on('message_deleted', (data) => setDeletedMessages(prev => [...prev.slice(-99), data]))
    // Permintaan nomor customer (agent -> admin): diteruskan sebagai event window
    s.on('number_request', (data) => {
      try { window.dispatchEvent(new CustomEvent('nr:changed', { detail: data })) } catch {}
    })

    // Push yang tiba saat dashboard sedang aktif diteruskan service worker ke sini.
    // Bila pesannya belum diterima lewat socket (socket bermasalah) -> tetap
    // bunyikan notifikasi & sinkron ulang, jadi tidak ada pesan yang terlewat.
    const onSwMessage = (ev) => {
      const d = ev?.data
      if (!d || d.type !== 'push') return
      const pd = d.payload?.data || {}
      const msgId = pd.messageId ? String(pd.messageId) : ''
      setTimeout(() => {
        if (msgId && seenMsgIds.current.has(msgId)) return // socket sudah menangani
        if (msgId && notifiedMsgIds.current.has(msgId)) return
        resync()
        if (!s.connected) s.connect()
        if (!pd.conversationId) return
        notifyNewMessage({
          conversationId: pd.conversationId,
          contactName: d.payload?.title,
          assignedTo: pd.assignedTo || null,
          message: { id: msgId || `push-${Date.now()}`, body: d.payload?.body, from_me: false, conversation_id: pd.conversationId },
        })
      }, 2500) // beri waktu socket yang datang sedikit terlambat
    }
    navigator.serviceWorker?.addEventListener?.('message', onSwMessage)

    return () => {
      clearInterval(hb); clearInterval(pollTimer); clearTimeout(bannerTimer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
      navigator.serviceWorker?.removeEventListener?.('message', onSwMessage)
      s.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{
      socket, socketConnected, socketError,
      waConnected, syncing, qrCode, setQrCode,
      newMessages, clearNewMessages: () => setNewMessages([]),
      statusUpdates, messageUpdates, assignmentUpdates, conversationUpdates, deletedMessages,
      resyncTick,
    }}>
      {showReconnecting && (
        <div className="rt-banner" role="status">
          <span className="rt-dot" />Menyambung ulang ke server… pesan baru akan muncul otomatis
          <style>{`
            .rt-banner { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 3000; display: inline-flex; align-items: center; gap: 8px; max-width: calc(100vw - 24px); padding: 7px 14px; border-radius: 999px; background: var(--surface); color: var(--text2); border: 1px solid rgba(208,139,40,0.45); box-shadow: 0 6px 20px var(--shadow); font-size: 12.5px; font-weight: 600; }
            .rt-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warning, #d08b28); flex-shrink: 0; animation: rtPulse 1s ease-in-out infinite; }
            @keyframes rtPulse { 50% { opacity: 0.3; } }
          `}</style>
        </div>
      )}
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

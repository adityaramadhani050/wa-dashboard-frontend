import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { isNative } from '../native/push'

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

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [waConnected, setWaConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketError, setSocketError] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [newMessages, setNewMessages] = useState([])
  const [statusUpdates, setStatusUpdates] = useState([])
  const [messageUpdates, setMessageUpdates] = useState([])
  const socketRef = useRef(null)
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
  const notifyNewMessage = (data) => {
    const msg = data?.message
    if (!msg || msg.from_me) return // hanya pesan masuk dari customer
    const convId = String(data.conversationId ?? msg.conversation_id ?? '')
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
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: false,
      timeout: 10000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      setSocketConnected(true)
      setSocketError(null)
    })
    s.on('connect_error', (err) => {
      setSocketConnected(false)
      setSocketError(err.message || 'Connection error')
    })
    s.on('disconnect', () => setSocketConnected(false))
    s.io.on('reconnect', () => setSocketError(null))
    s.io.on('reconnect_failed', () => setSocketError('Failed to reconnect — check backend'))

    s.on('qr', (data) => { setQrCode(data); setWaConnected(false) })
    s.on('wa_status', (data) => {
      const connected = data === true || data?.connected === true
      setWaConnected(connected)
      if (connected) setQrCode(null)
    })
    s.on('new_message', (data) => {
      setNewMessages(prev => [...prev.slice(-99), data])
      notifyNewMessage(data)
    })
    s.on('message_status', (data) => setStatusUpdates(prev => [...prev.slice(-99), data]))
    // Update field pesan yang menyusul (mis. media_url selesai diunggah) — tanpa notifikasi
    s.on('message_updated', (data) => setMessageUpdates(prev => [...prev.slice(-99), data]))

    return () => s.disconnect()
  }, [])

  return (
    <SocketContext.Provider value={{
      socket, socketConnected, socketError,
      waConnected, qrCode, setQrCode,
      newMessages, clearNewMessages: () => setNewMessages([]),
      statusUpdates, messageUpdates,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

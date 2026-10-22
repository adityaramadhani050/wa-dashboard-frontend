import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useMatch, useLocation } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { formatDurShort as formatWaitShort, formatDurLong as formatWaitLong } from '../lib/duration'
import { useAiAgentId } from '../hooks/useAiAgent'
import { getConversationsPage, getTags, getAgents, syncMessages, getWorkHours, getMyAvailability, setMyAvailability } from '../hooks/useApi'
import { Search, RefreshCw, UserCheck, Tag as TagIcon, ChevronDown, Clock, RotateCw, X, MapPin, Bot, CheckCheck, SearchX, MessagesSquare, ListFilter, Sparkles } from 'lucide-react'

// Regional chat: dari percakapan, atau dari kontak (customer lama)
const chatRegion = (c) => c.region || c.contact?.region || null
const REGION_FILTER_OPTIONS = [
  { key: 'all', label: 'Semua Regional' },
  { key: 'barat', label: 'Barat' },
  { key: 'timur', label: 'Timur' },
  { key: 'unknown', label: 'Regional belum diketahui' },
  { key: 'bot', label: 'Sedang ditanya bot' },
]

// KPI response time: customer harus dibalas dalam 5 menit
const RESPONSE_KPI_MS = 5 * 60 * 1000

function waitMinutes(awaitingSince, now) {
  if (!awaitingSince) return 0
  return Math.floor((now - new Date(awaitingSince).getTime()) / 60000)
}

// Apakah saat ini (ms) berada dalam jam & hari kerja (zona WIB / UTC+7)?
// Jika fitur mati atau tidak ada config -> selalu dianggap "dalam jam kerja".
function isWithinWorkHours(nowMs, wh) {
  if (!wh || !wh.enabled) return true
  const wib = new Date(nowMs + 7 * 3600 * 1000)
  const day = wib.getUTCDay() // 0=Minggu .. 6=Sabtu
  if (Array.isArray(wh.days) && wh.days.length && !wh.days.includes(day)) return false
  const mins = wib.getUTCHours() * 60 + wib.getUTCMinutes()
  const [sh, sm] = (wh.start || '08:00').split(':').map(Number)
  const [eh, em] = (wh.end || '17:00').split(':').map(Number)
  return mins >= (sh * 60 + sm) && mins < (eh * 60 + em)
}

function statusLabel(s) {
  if (s === 'in_progress') return 'Aktif'
  if (s === 'resolved') return 'Resolved'
  return 'Open'
}

const AVATAR_COLORS = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
function avatarStyle(name) {
  const letter = (name || '?')[0].toUpperCase()
  const c = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  return { background: c + '22', color: c }
}

// Waktu pesan terakhir ala WhatsApp: 14.05 · Kemarin · Senin · 7 Okt
function timeStr(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= today) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (t >= today - 86400000) return 'Kemarin'
  if (t >= today - 6 * 86400000) return d.toLocaleDateString('id-ID', { weekday: 'long' })
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: '2-digit' } : {}) })
}

export default function InboxPage() {
  const aiAgentId = useAiAgentId()
  const [conversations, setConversations] = useState([])
  const convRef = useRef(conversations)
  convRef.current = conversations
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState([])
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all') // all | unread | unreplied | replied
  const [lifecycleFilter, setLifecycleFilter] = useState('all') // all | open | in_progress | resolved
  const [showLifecycleFilter, setShowLifecycleFilter] = useState(false)
  const [agents, setAgents] = useState([])
  const [agentFilter, setAgentFilter] = useState(null)
  const [showAgentFilter, setShowAgentFilter] = useState(false)
  const [regionFilter, setRegionFilter] = useState('all')
  const [showRegionFilter, setShowRegionFilter] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [workHours, setWorkHours] = useState(null)
  const { newMessages, assignmentUpdates, conversationUpdates, socketConnected, waConnected, syncing, resyncTick } = useSocket()
  const [refreshing, setRefreshing] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [myAvailable, setMyAvailable] = useState(true)
  const [availBusy, setAvailBusy] = useState(false)
  const navigate = useNavigate()
  const matchChat = useMatch('/chat/:id')
  // Pemberitahuan dari halaman lain (mis. "Chat ini sudah dipindahkan ke agent lain")
  const location = useLocation()
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const n = location.state?.notice
    if (!n) return
    setNotice(n)
    navigate(location.pathname, { replace: true, state: null })
    const t = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(t)
  }, [location.state, location.pathname, navigate])
  const activeChatId = matchChat?.params?.id

  // Daftar dimuat per halaman dari server (100 chat), filter & pencarian dijalankan
  // di server agar tetap ringan & menemukan chat lama. Chat yang menunggu balasan
  // > 5 menit ikut dimuat di halaman pertama (disematkan di atas).
  const PAGE = 100
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(t) }, [search])
  const [total, setTotal] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef({ cursor: null, skip: [], hasMore: false, reqId: 0, loadingMore: false })
  const queryParams = useCallback(() => {
    const p = { limit: PAGE }
    // agent biasa hanya lihat chat miliknya (server juga membatasi); admin bisa filter per agent
    if (user?.role === 'agent') p.agent_id = user.id
    else if (agentFilter) p.agent_id = agentFilter
    if (debouncedSearch) p.q = debouncedSearch
    if (activeTagFilter) p.tag = activeTagFilter
    if (statusFilter !== 'all') p.reply = statusFilter
    if (lifecycleFilter !== 'all') p.status = lifecycleFilter
    if (regionFilter !== 'all') p.region = regionFilter
    return p
  }, [user, agentFilter, debouncedSearch, activeTagFilter, statusFilter, lifecycleFilter, regionFilter])
  const mergeUnique = (...lists) => {
    const seen = new Set(); const out = []
    for (const l of lists) for (const c of l || []) { const k = String(c.id); if (!seen.has(k)) { seen.add(k); out.push(c) } }
    return out
  }

  const fetch = useCallback(async () => {
    const reqId = ++pageRef.current.reqId
    try {
      const d = await getConversationsPage(queryParams())
      if (reqId !== pageRef.current.reqId) return // sudah ada permintaan yang lebih baru
      setConversations(mergeUnique(d?.pinned, d?.items))
      pageRef.current = { ...pageRef.current, cursor: d?.nextCursor || null, skip: d?.nextSkip || [], hasMore: !!d?.hasMore }
      setHasMore(!!d?.hasMore)
      setTotal(typeof d?.total === 'number' ? d.total : null)
    } catch {}
    finally { if (reqId === pageRef.current.reqId) setLoading(false) }
  }, [queryParams])

  const loadMore = useCallback(async () => {
    const pg = pageRef.current
    if (!pg.hasMore || pg.loadingMore || !pg.cursor) return
    pg.loadingMore = true; setLoadingMore(true)
    const reqId = pg.reqId
    try {
      const d = await getConversationsPage({ ...queryParams(), cursor: pg.cursor, skip: (pg.skip || []).join(',') || undefined })
      if (reqId !== pageRef.current.reqId) return
      setConversations(prev => mergeUnique(prev, d?.items))
      pageRef.current = { ...pageRef.current, cursor: d?.nextCursor || null, skip: d?.nextSkip || [], hasMore: !!d?.hasMore }
      setHasMore(!!d?.hasMore)
    } catch {}
    finally { pageRef.current.loadingMore = false; setLoadingMore(false) }
  }, [queryParams])

  // Chat yang belum ada di daftar (pesan baru / baru di-assign): ambil chat itu saja,
  // dengan filter yang sedang aktif agar chat di luar filter tidak ikut masuk
  const fetchByIds = useCallback(async (ids) => {
    if (!ids.length) return
    try {
      const { limit: _l, ...filters } = queryParams()
      const d = await getConversationsPage({ ...filters, ids: ids.slice(0, 50).join(',') })
      if (d?.items?.length) setConversations(prev => mergeUnique(d.items, prev))
    } catch {}
  }, [queryParams])

  useEffect(() => { fetch() }, [fetch])
  // Sinkron ulang (tersambung lagi / tab aktif lagi / polling saat terputus)
  useEffect(() => { if (resyncTick) fetch() }, [resyncTick, fetch])

  // Refetch saat socket reconnect (menyusul update yang terlewat saat offline)
  const wasConnectedRef = useRef(socketConnected)
  useEffect(() => {
    if (socketConnected && !wasConnectedRef.current) fetch()
    wasConnectedRef.current = socketConnected
  }, [socketConnected, fetch])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    try { await fetch() } finally {
      // Berputar minimal 700 ms & berhenti setelah daftar selesai digambar ulang
      const rest = Math.max(0, 700 - (Date.now() - started))
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => setRefreshing(false))), rest)
    }
  }, [refreshing, fetch])

  // Sinkronisasi otomatis HANYA saat WA benar-benar tersambung KEMBALI
  // (setelah sempat terputus di sesi ini, mis. scan ulang QR).
  // Bukan saat koneksi pertama/reload halaman — itu tidak memicu sync.
  const hasConnectedOnce = useRef(false)
  const sawDisconnect = useRef(false)
  useEffect(() => {
    if (waConnected) {
      if (hasConnectedOnce.current && sawDisconnect.current) {
        syncMessages().catch(() => {})   // reconnect nyata -> sync
      }
      hasConnectedOnce.current = true
      sawDisconnect.current = false
    } else if (hasConnectedOnce.current) {
      sawDisconnect.current = true       // sempat terputus setelah tersambung
    }
  }, [waConnected])

  // Setelah sinkronisasi selesai (syncing true -> false), muat ulang daftar chat
  const wasSyncingRef = useRef(false)
  useEffect(() => {
    if (wasSyncingRef.current && !syncing) fetch()
    wasSyncingRef.current = syncing
  }, [syncing, fetch])

  // Update list secara instan saat ada pesan baru (tanpa refetch seluruh daftar
  // yang berat). Hanya fallback fetch() bila percakapannya belum ada di list.
  const processedRef = useRef(null)
  useEffect(() => {
    // Lewati event yang sudah ada di buffer saat pertama mount (sudah tercakup fetch awal)
    if (processedRef.current === null) { processedRef.current = newMessages.length; return }
    if (newMessages.length === 0) return
    const fresh = newMessages.slice(processedRef.current)
    processedRef.current = newMessages.length
    if (!fresh.length) return

    // Chat yang belum ada di daftar -> ambil chat itu saja (bukan seluruh daftar)
    const have = new Set(convRef.current.map(c => String(c.id)))
    const missing = [...new Set(fresh.map(e => String(e.conversationId ?? e.message?.conversation_id ?? '')).filter(id => id && !have.has(id)))]
    setConversations(prev => {
      let list = prev
      for (const evt of fresh) {
        const cid = String(evt.conversationId ?? evt.message?.conversation_id ?? '')
        if (!cid) continue
        const idx = list.findIndex(c => String(c.id) === cid)
        if (idx === -1) continue
        const msg = evt.message || {}
        const fromMe = !!msg.from_me
        const ts = msg.timestamp || new Date().toISOString()
        const prevStatus = list[idx].status
        const updated = {
          ...list[idx],
          lastMessage: msg.body ?? list[idx].lastMessage,
          lastMessageAt: ts,
          lastFromMe: fromMe,
          unread: fromMe ? false : (String(activeChatId) !== cid),
          awaitingSince: fromMe ? null : (list[idx].awaitingSince || ts),
          // agent membalas -> Aktif; pesan customer pada chat resolved -> reaktivasi
          status: fromMe ? 'in_progress'
            : (prevStatus === 'resolved' ? (list[idx].assigned_to ? 'in_progress' : 'open') : prevStatus),
        }
        list = [updated, ...list.slice(0, idx), ...list.slice(idx + 1)]
      }
      return list
    })
    fetchByIds(missing)
  }, [newMessages, fetchByIds, activeChatId])

  // Auto-assign realtime: update badge agent tanpa refresh
  const processedAssignRef = useRef(null)
  useEffect(() => {
    if (processedAssignRef.current === null) { processedAssignRef.current = assignmentUpdates.length; return }
    const fresh = assignmentUpdates.slice(processedAssignRef.current)
    processedAssignRef.current = assignmentUpdates.length
    if (!fresh.length) return
    const isAgent = user?.role === 'agent'
    const have = new Set(convRef.current.map(c => String(c.id)))
    // Agent: chat yang baru di-assign ke dirinya belum ada di daftar -> ambil chat itu
    const watchId = isAgent ? user.id : agentFilter
    const newlyMine = watchId ? [...new Set(fresh.filter(e => String(e.agent?.id ?? '') === String(watchId)).map(e => String(e.conversationId)))].filter(id => !have.has(id)) : []
    setConversations(prev => {
      let list = prev
      for (const evt of fresh) {
        const cid = String(evt.conversationId ?? '')
        // Agent: chat dipindah ke agent lain / dilepas -> langsung hilang dari daftarnya
        if (isAgent && String(evt.agent?.id ?? '') !== String(user.id)) {
          list = list.filter(c => String(c.id) !== cid)
          continue
        }
        // Admin memfilter agent tertentu: chat yang dipindah ke agent lain ikut keluar
        if (!isAgent && agentFilter && String(evt.agent?.id ?? '') !== String(agentFilter)) {
          list = list.filter(c => String(c.id) !== cid)
          continue
        }
        const idx = list.findIndex(c => String(c.id) === cid)
        if (idx === -1) continue
        list = list.map((c, i) => {
          if (i !== idx) return c
          if (evt.agent) return { ...c, agents: evt.agent, assigned_to: evt.agent.id, status: 'in_progress' }
          // unassign: badge agent hilang, status balik Open (kecuali resolved)
          return { ...c, agents: null, assigned_to: null, status: c.status === 'in_progress' ? 'open' : c.status }
        })
      }
      return list
    })
    fetchByIds(newlyMine)
  }, [assignmentUpdates, fetchByIds, user, agentFilter])

  // Regional / status bot lokasi berubah: update badge tanpa refetch
  const processedConvUpdRef = useRef(null)
  useEffect(() => {
    if (processedConvUpdRef.current === null) { processedConvUpdRef.current = conversationUpdates.length; return }
    const fresh = conversationUpdates.slice(processedConvUpdRef.current)
    processedConvUpdRef.current = conversationUpdates.length
    if (!fresh.length) return
    // Chat dihapus -> hilangkan dari daftar
    const deleted = new Set(fresh.filter(e => e.deleted).map(e => String(e.conversationId)))
    setConversations(prev => prev.filter(c => !deleted.has(String(c.id))).map(c => {
      const evts = fresh.filter(e => String(e.conversationId) === String(c.id))
      if (!evts.length) return c
      let next = { ...c, contact: c.contact ? { ...c.contact } : c.contact }
      for (const e of evts) {
        if (e.region !== undefined) {
          next.region = e.region
          if (next.contact) next.contact.region = e.region
        }
        if (e.bot_state !== undefined) next.bot_state = e.bot_state
        if (next.contact && e.city !== undefined) next.contact.city = e.city
        if (next.contact && e.province !== undefined) next.contact.province = e.province
      }
      return next
    }))
  }, [conversationUpdates])

  useEffect(() => { getTags().then(d => setTags(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  useEffect(() => { getWorkHours().then(setWorkHours).catch(() => {}) }, [])
  useEffect(() => { if (!isAdmin) getMyAvailability().then(d => setMyAvailable(d?.available !== false)).catch(() => {}) }, [isAdmin])

  const handleToggleMyAvail = useCallback(async () => {
    if (availBusy) return
    const next = !myAvailable
    setAvailBusy(true)
    try { await setMyAvailability(next); setMyAvailable(next) }
    catch (e) { alert(e?.response?.data?.error || 'Gagal mengubah status ketersediaan') }
    finally { setAvailBusy(false) }
  }, [availBusy, myAvailable])
  useEffect(() => {
    if (isAdmin) getAgents().then(d => setAgents(Array.isArray(d) ? d.filter(a => a.role === 'agent') : [])).catch(() => {})
  }, [isAdmin])
  // Tick tiap 30 detik supaya indikator ">5 menit" & urutan prioritas selalu update
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const handler = () => fetch()
    window.addEventListener('cv:conversation-updated', handler)
    return () => window.removeEventListener('cv:conversation-updated', handler)
  }, [fetch])

  const handleOpenConversation = (convId) => {
    setConversations(prev => prev.map(c => String(c.id) === String(convId) ? { ...c, unread: false } : c))
    navigate(`/chat/${convId}`)
  }

  // Chat yang dikecualikan dari KPI overdue: "fail" (lead mati), "deal"
  // (sudah closing -> koordinasi), & "non-client" (bukan calon klien)
  const isOverdueExempt = (c) => (c.tags || []).some(t => {
    const n = (t.name || '').toLowerCase()
    return n === 'fail' || n === 'deal' || /non[\s_-]*client/.test(n)
  })
  // Overdue tidak berlaku di luar jam/hari kerja (bila fitur diaktifkan admin)
  const withinWorkHours = isWithinWorkHours(now, workHours)
  // Chat overdue = customer menunggu > 5 menit & belum dibalas, kecuali fail/deal,
  // dan hanya dihitung saat dalam jam kerja.
  const isOverdue = (c) => withinWorkHours && !!c.awaitingSince && c.lastFromMe === false && !isOverdueExempt(c) &&
    (now - new Date(c.awaitingSince).getTime()) > RESPONSE_KPI_MS

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      c.contact?.name?.toLowerCase().includes(q) ||
      c.contact?.phone?.includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
    const matchesTag = !activeTagFilter || c.tags?.some(t => t.id === activeTagFilter)
    let matchesStatus = true
    if (statusFilter === 'unread') matchesStatus = !!c.unread
    else if (statusFilter === 'unreplied') matchesStatus = c.lastFromMe === false
    else if (statusFilter === 'replied') matchesStatus = c.lastFromMe === true
    let matchesLifecycle = true
    if (lifecycleFilter !== 'all') {
      const st = c.status || 'open'
      matchesLifecycle = st === lifecycleFilter
    }
    let matchesRegion = true
    if (regionFilter === 'barat' || regionFilter === 'timur') matchesRegion = chatRegion(c) === regionFilter
    else if (regionFilter === 'unknown') matchesRegion = !chatRegion(c)
    else if (regionFilter === 'bot') matchesRegion = c.bot_state === 'awaiting_location'
    return matchesSearch && matchesTag && matchesStatus && matchesLifecycle && matchesRegion
  })

  // Urutkan: chat overdue (>5 menit) paling atas, yang paling lama menunggu duluan;
  // sisanya berdasarkan pesan terakhir terbaru.
  const sorted = [...filtered].sort((a, b) => {
    const ao = isOverdue(a), bo = isOverdue(b)
    if (ao && bo) return new Date(a.awaitingSince) - new Date(b.awaitingSince)
    if (ao) return -1
    if (bo) return 1
    return new Date(b.lastMessageAt || b.updated_at || 0) - new Date(a.lastMessageAt || a.updated_at || 0)
  })

  // Gulir ke bawah -> muat halaman berikutnya dari server
  const moreRef = useRef(null)
  useEffect(() => {
    const el = moreRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) loadMore()
    }, { root: el.closest('.cl-list'), rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })

  const STATUS_FILTERS = [
    { key: 'all', label: 'Semua', short: 'Semua' },
    { key: 'unread', label: 'Belum dibaca', short: 'Belum baca' },
    { key: 'unreplied', label: 'Belum dibalas', short: 'Belum balas' },
    { key: 'replied', label: 'Sudah dibalas', short: 'Dibalas' },
  ]
  const LIFECYCLE_OPTIONS = [
    { key: 'all', label: 'Semua Status' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'Aktif' },
    { key: 'resolved', label: 'Resolved' },
  ]
  const lifecycleLabel = LIFECYCLE_OPTIONS.find(o => o.key === lifecycleFilter)?.label || 'Semua Status'
  const hasFilter = !!search || statusFilter !== 'all' || !!activeTagFilter || lifecycleFilter !== 'all' || !!agentFilter || regionFilter !== 'all'
  const resetFilters = () => {
    setSearch(''); setStatusFilter('all'); setActiveTagFilter(null); setLifecycleFilter('all'); setAgentFilter(null); setRegionFilter('all')
  }

  return (
    <div className="cl-root" onClick={() => { if (showTagFilter) setShowTagFilter(false); if (showAgentFilter) setShowAgentFilter(false); if (showLifecycleFilter) setShowLifecycleFilter(false) }}>
      {/* Header */}
      <div className="cl-header">
        <div className="cl-header-top">
          <h2>Chats{!loading && <span className="cl-count">{total != null && regionFilter !== 'barat' && regionFilter !== 'timur' && regionFilter !== 'unknown' && statusFilter !== 'unread' ? total : `${sorted.length}${hasMore ? '+' : ''}`}</span>}</h2>
          <div className="cl-header-actions">
            {/* Toggle ketersediaan hanya untuk agent — auto-assign tidak berlaku ke admin */}
            {!isAdmin && (
              <button
                className={`cl-avail${myAvailable ? ' on' : ''}`}
                onClick={handleToggleMyAvail}
                disabled={availBusy}
                role="switch"
                aria-checked={myAvailable}
                title={myAvailable
                  ? 'Anda AKTIF — bisa menerima chat otomatis. Klik untuk non-aktif (izin/sakit/cuti).'
                  : 'Anda NON-AKTIF — tidak menerima auto-assign. Klik untuk aktif kembali.'}
              >
                <span className="cl-avail-dot" />
                <span className="cl-avail-text">{myAvailable ? 'Aktif' : 'Non-aktif'}</span>
              </button>
            )}
            <button className="cl-icon-btn" onClick={handleRefresh} disabled={refreshing} title="Refresh daftar">
              {/* Diputar lewat span (animasi compositor) agar tetap berputar walau
                  browser sedang sibuk merender ratusan chat */}
              <span className={`cl-spin-wrap${refreshing ? ' on' : ''}`}><RefreshCw size={15} /></span>
            </button>
          </div>
        </div>
        {notice && (
          <div className="cl-notice" role="status" onClick={() => setNotice('')}>{notice}</div>
        )}
        {syncing && (
          <div className="cl-sync-banner">
            <RotateCw size={13} className="cl-spin" />
            <span>Menyinkronkan pesan…</span>
          </div>
        )}
        {/* Search */}
        <div className="cl-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="cl-search-clear" title="Hapus pencarian" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {/* Status filter (segmented) */}
        <div className="cl-seg" role="tablist">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={statusFilter === f.key}
              className={statusFilter === f.key ? 'active' : ''}
              onClick={() => setStatusFilter(f.key)}
              title={f.label}
            ><span className="cl-seg-full">{f.label}</span><span className="cl-seg-short">{f.short}</span></button>
          ))}
        </div>
        {/* Filter Tag + Status + Agent — satu baris sejajar (Agent hanya admin) */}
        <div className="cl-tagfilter-row" onClick={e => e.stopPropagation()}>
          <div className="cl-dd">
            <button className={`cl-tagfilter-btn${activeTagFilter ? ' active' : ''}`} onClick={() => { setShowTagFilter(s => !s); setShowAgentFilter(false); setShowLifecycleFilter(false) }}>
              <TagIcon size={13} />
              <span>{activeTagFilter ? (tags.find(t => t.id === activeTagFilter)?.name || 'Tag') : 'Semua Tag'}</span>
              <ChevronDown size={13} className="cl-chev" />
            </button>
            {showTagFilter && (
              <div className="cl-menu" style={{ minWidth: 160 }}>
                <button className={`cl-mi${!activeTagFilter ? ' active' : ''}`} onClick={() => { setActiveTagFilter(null); setShowTagFilter(false) }}>
                  Semua Tag
                </button>
                {tags.map(t => (
                  <button key={t.id} className={`cl-mi${activeTagFilter === t.id ? ' active' : ''}`} onClick={() => { setActiveTagFilter(t.id); setShowTagFilter(false) }}>
                    <span className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cl-dd">
            <button className={`cl-tagfilter-btn${lifecycleFilter !== 'all' ? ' active' : ''}`} onClick={() => { setShowLifecycleFilter(s => !s); setShowTagFilter(false); setShowAgentFilter(false) }}>
              <ListFilter size={13} />
              <span>{lifecycleLabel}</span>
              <ChevronDown size={13} className="cl-chev" />
            </button>
            {showLifecycleFilter && (
              <div className="cl-menu" style={{ minWidth: 150 }}>
                {LIFECYCLE_OPTIONS.map(o => (
                  <button key={o.key} className={`cl-mi${lifecycleFilter === o.key ? ' active' : ''}`} onClick={() => { setLifecycleFilter(o.key); setShowLifecycleFilter(false) }}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="cl-dd">
              <button className={`cl-tagfilter-btn${agentFilter ? ' active' : ''}`} onClick={() => { setShowAgentFilter(s => !s); setShowTagFilter(false); setShowLifecycleFilter(false) }}>
                <UserCheck size={13} />
                <span>{agentFilter ? (agents.find(a => a.id === agentFilter)?.name || 'Agent') : 'Semua Agent'}</span>
                <ChevronDown size={13} className="cl-chev" />
              </button>
              {showAgentFilter && (
                <div className="cl-menu" style={{ minWidth: 180, left: 'auto', right: 0 }}>
                  <button className={`cl-mi${!agentFilter ? ' active' : ''}`} onClick={() => { setAgentFilter(null); setShowAgentFilter(false) }}>
                    Semua Agent
                  </button>
                  {agents.map(a => (
                    <button key={a.id} className={`cl-mi${agentFilter === a.id ? ' active' : ''}`} onClick={() => { setAgentFilter(a.id); setShowAgentFilter(false) }}>
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isAdmin && (
            <div className="cl-dd">
              <button className={`cl-tagfilter-btn${regionFilter !== 'all' ? ' active' : ''}`} onClick={() => { setShowRegionFilter(s => !s); setShowTagFilter(false); setShowLifecycleFilter(false); setShowAgentFilter(false) }}>
                <MapPin size={13} />
                <span>{REGION_FILTER_OPTIONS.find(o => o.key === regionFilter)?.label || 'Semua Regional'}</span>
                <ChevronDown size={13} className="cl-chev" />
              </button>
              {showRegionFilter && (
                <div className="cl-menu" style={{ minWidth: 200, left: 'auto', right: 0 }}>
                  {REGION_FILTER_OPTIONS.map(o => (
                    <button key={o.key} className={`cl-mi${regionFilter === o.key ? ' active' : ''}`} onClick={() => { setRegionFilter(o.key); setShowRegionFilter(false) }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="cl-list">
        {loading ? (
          [...Array(7)].map((_, i) => (
            <div key={i} className="cl-skel" style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="cl-skel-av" />
              <span className="cl-skel-lines"><i /><i /></span>
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className="cl-empty">
            {hasFilter ? <SearchX size={34} strokeWidth={1.5} /> : <MessagesSquare size={34} strokeWidth={1.5} />}
            <p>{hasFilter ? 'Tidak ada chat yang cocok dengan filter.' : 'Belum ada percakapan.'}</p>
            {hasFilter && <button className="cl-empty-reset" onClick={resetFilters}>Reset filter</button>}
          </div>
        ) : (
          <>{sorted.map(conv => {
            const isActive = String(conv.id) === String(activeChatId)
            const name = conv.contact?.name || conv.contact?.phone || 'Unknown'
            const initial = name[0].toUpperCase()
            const preview = conv.lastMessage || 'Belum ada pesan'
            const assignedAgent = conv.agents
            const agentLabel = assignedAgent?.name?.length > 12
              ? assignedAgent.name.slice(0, 12) + '…'
              : assignedAgent?.name
            const isUnread = !!conv.unread && !isActive
            const overdue = isOverdue(conv) && !isActive
            const waitMins = overdue ? waitMinutes(conv.awaitingSince, now) : 0

            return (
              <div
                key={conv.id}
                className={`cl-item${isActive ? ' active' : ''}${isUnread ? ' unread' : ''}${overdue ? ' overdue' : ''}`}
                onClick={() => handleOpenConversation(conv.id)}
              >
                <div className="cl-avatar" style={avatarStyle(name)}>{initial}</div>
                <div className="cl-info">
                  <div className="cl-row">
                    <span className="cl-name">{name}</span>
                    <span className="cl-row-right">
                      {overdue && (
                        <span className="cl-overdue-badge" title={`Belum dibalas ${formatWaitLong(waitMins)} (lewat KPI 5 menit)`}>
                          <Clock size={10} />{formatWaitShort(waitMins)}
                        </span>
                      )}
                      {isUnread && <span className="cl-unread-dot" />}
                      {/* Chat overdue: badge sudah menunjukkan lama menunggu -> waktu pesan terakhir disembunyikan */}
                      {!overdue && <span className="cl-time">{timeStr(conv.lastMessageAt || conv.updated_at)}</span>}
                    </span>
                  </div>
                  <div className="cl-row">
                    <span className="cl-preview">
                      {conv.lastFromMe && conv.lastMessage && <CheckCheck size={14} className="cl-tick" />}
                      <span className="cl-preview-text">{preview}</span>
                    </span>
                    {isAdmin && assignedAgent && (
                      <span className={`cl-agent-badge${aiAgentId && String(assignedAgent.id) === aiAgentId ? ' ai' : ''}`} title={aiAgentId && String(assignedAgent.id) === aiAgentId ? `${assignedAgent.name} (AI Sales)` : assignedAgent.name}>
                        {aiAgentId && String(assignedAgent.id) === aiAgentId ? <Sparkles size={9} /> : <UserCheck size={9} />}{agentLabel}
                      </span>
                    )}
                  </div>
                  <div className="cl-tags-row">
                    <span className={`cl-status-badge st-${conv.status || 'open'}`}>{statusLabel(conv.status)}</span>
                    {conv.tags?.slice(0, 3).map(t => (
                      <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                    ))}
                    {/* Kolom kanan: badge regional tepat di bawah badge nama agent */}
                    {isAdmin && (conv.bot_state === 'awaiting_location' || chatRegion(conv) || conv.bot_state === 'unresolved') && (
                      <span className="cl-region-slot">
                        {conv.bot_state === 'awaiting_location' ? (
                          <span className="cl-region-badge bot" title="Bot sedang menanyakan lokasi customer"><Bot size={10} />Bot bertanya</span>
                        ) : chatRegion(conv) ? (
                          <span className={`cl-region-badge ${chatRegion(conv)}`} title={[conv.contact?.city, conv.contact?.province].filter(Boolean).join(', ') || 'Regional'}>
                            <MapPin size={10} />{chatRegion(conv) === 'barat' ? 'Barat' : 'Timur'}
                          </span>
                        ) : (
                          <span className="cl-region-badge unknown" title="Lokasi tidak terdeteksi — tentukan regional secara manual">Regional?</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {hasMore && <div ref={moreRef} className="cl-more" aria-hidden="true">{loadingMore && <span className="cl-more-spin"><RotateCw size={14} /></span>}</div>}</>
        )}
      </div>

      <style>{`
        .cl-root { display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--surface); overflow: hidden; }
        .cl-header { padding: 16px 16px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
        .cl-header-top { display: flex; align-items: center; justify-content: space-between; min-height: 32px; }
        .cl-header-top h2 { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 700; color: var(--text); }
        .cl-count { font-size: 11.5px; font-weight: 700; color: var(--text2); background: var(--surface3); padding: 2px 8px; border-radius: 999px; }
        .cl-icon-btn { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: background 0.15s, color 0.15s; }
        .cl-icon-btn:hover { background: var(--surface3); color: var(--text2); }
        .cl-icon-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cl-header-actions { display: flex; align-items: center; gap: 6px; }
        .cl-avail { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); background: var(--surface2); color: var(--muted); transition: all 0.15s; }
        .cl-avail:disabled { opacity: 0.6; }
        .cl-avail .cl-avail-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; transition: background 0.15s; }
        .cl-avail.on { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); background: color-mix(in srgb, var(--success) 12%, transparent); }
        .cl-avail.on .cl-avail-dot { background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent); }
        @media (max-width: 380px) { .cl-avail-text { display: none; } }
        .cl-sync-banner { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 9px; background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 600; }
        .cl-spin { animation: spin 0.8s linear infinite; }
        .cl-spin-wrap { display: inline-flex; }
        .cl-more { min-height: 1px; display: flex; justify-content: center; padding: 6px 0; color: var(--muted); }
        .cl-more-spin { display: inline-flex; animation: spin 0.8s linear infinite; }
        .cl-notice { margin: 0 14px 8px; padding: 9px 12px; border-radius: 10px; background: rgba(208,139,40,0.12); border: 1px solid rgba(208,139,40,0.35); color: var(--text); font-size: 12.5px; line-height: 1.4; cursor: pointer; }
        .cl-spin-wrap.on { animation: spin 0.8s linear infinite; will-change: transform; }
        /* Ratusan chat: browser hanya menggambar baris yang terlihat di layar */
        .cl-item { content-visibility: auto; contain-intrinsic-size: auto 84px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cl-search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; transition: border-color 0.15s, background 0.15s; }
        .cl-search:focus-within { border-color: var(--primary); background: var(--surface); }
        .cl-search svg { color: var(--muted); flex-shrink: 0; }
        .cl-search input { background: none; border: none; outline: none; color: var(--text); font-size: 13.5px; width: 100%; }
        .cl-search input::placeholder { color: var(--muted); }
        .cl-search-clear { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; color: var(--muted); transition: background 0.12s, color 0.12s; }
        .cl-search-clear:hover { background: var(--surface3); color: var(--text); }
        .cl-search-clear svg { color: inherit; }
        /* Filter status: segmented control (selalu muat, tanpa scroll) */
        .cl-seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .cl-seg button { height: 28px; padding: 0 4px; border-radius: 7px; font-size: 12px; font-weight: 600; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.15s, color 0.15s; }
        .cl-seg button:hover:not(.active) { background: var(--surface3); }
        .cl-seg button.active { background: var(--primary); color: var(--on-primary); box-shadow: 0 1px 3px var(--shadow); }
        .cl-seg-short { display: none; }
        @media (max-width: 480px) { .cl-seg-full { display: none; } .cl-seg-short { display: inline; } .cl-seg button { font-size: 11.5px; } }
        .cl-tagfilter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cl-dd { position: relative; min-width: 0; }
        .cl-tagfilter-btn { width: 100%; height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border-radius: 9px; font-size: 12.5px; font-weight: 500; color: var(--text2); background: var(--surface); border: 1px solid var(--border); transition: all 0.15s; }
        .cl-tagfilter-btn svg { flex-shrink: 0; color: var(--muted); }
        .cl-tagfilter-btn span { flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cl-tagfilter-btn:hover { background: var(--surface2); border-color: var(--border2); }
        .cl-tagfilter-btn.active { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 45%, transparent); background: var(--primary-light); }
        .cl-tagfilter-btn.active svg { color: var(--primary); }
        .cl-chev { margin-left: auto; }
        .cl-menu { position: absolute; left: 0; top: calc(100% + 6px); min-width: 100%; max-height: 320px; overflow-y: auto; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; z-index: 200; box-shadow: 0 10px 30px var(--shadow); }
        .cl-mi { display: flex; align-items: center; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px; font-size: 13px; color: var(--text); transition: background 0.1s; }
        .cl-mi:hover { background: var(--surface3); }
        .cl-mi.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
        .cl-list { flex: 1; min-height: 0; overflow-y: auto; }
        .cl-skel { display: flex; align-items: center; gap: 12px; padding: 14px 16px; animation: pulse 1.4s ease infinite; }
        .cl-skel-av { width: 44px; height: 44px; border-radius: 50%; background: var(--skeleton); flex-shrink: 0; }
        .cl-skel-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .cl-skel-lines i { display: block; height: 11px; border-radius: 6px; background: var(--skeleton); }
        .cl-skel-lines i:first-child { width: 45%; } .cl-skel-lines i:last-child { width: 80%; }
        .cl-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13px; }
        .cl-empty-reset { padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--primary); background: var(--primary-light); }
        .cl-item { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.1s; }
        .cl-item::after { content: ''; position: absolute; left: 72px; right: 0; bottom: 0; height: 1px; background: var(--border); }
        .cl-item:hover { background: var(--surface2); }
        .cl-item.active { background: var(--primary-light); box-shadow: inset 3px 0 0 var(--primary); }
        .cl-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
        .cl-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .cl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
        .cl-name { font-size: 14.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .cl-time { font-size: 11.5px; color: var(--muted); flex-shrink: 0; }
        .cl-preview { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); }
        .cl-preview-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cl-tick { flex-shrink: 0; color: var(--primary); opacity: 0.85; }
        .cl-agent-badge.ai { background: rgba(124,58,237,0.13); color: #8b5cf6; }
        .cl-agent-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: rgba(39,168,122,0.12); color: var(--success); white-space: nowrap; flex-shrink: 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 768px) { .cl-root { width: 100vw; } }
        .cl-tags-row { display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap; align-items: center; }
        .cl-region-slot { margin-left: auto; display: inline-flex; flex-shrink: 0; }
        .tag-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: var(--on-primary); white-space: nowrap; }
        .cl-status-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
        .cl-status-badge.st-open { background: rgba(208,139,40,0.14); color: var(--warning); }
        .cl-status-badge.st-in_progress { background: var(--primary-light); color: var(--primary); }
        .cl-status-badge.st-resolved { background: rgba(39,168,122,0.14); color: var(--success); }
        .cl-region-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
        .cl-region-badge.barat { color: #2563eb; background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.3); }
        .cl-region-badge.timur { color: #d97706; background: rgba(217,119,6,0.12); border-color: rgba(217,119,6,0.3); }
        .cl-region-badge.bot { color: var(--primary); background: var(--primary-light); }
        .cl-region-badge.unknown { color: var(--warning, #d08b28); background: rgba(208,139,40,0.12); border: 1px dashed rgba(208,139,40,0.5); }
        @media (prefers-color-scheme: dark) {
          .cl-region-badge.barat { color: #7aa7ff; } .cl-region-badge.timur { color: #f0a94a; }
        }
        .cl-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cl-unread-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--primary); flex-shrink: 0; }
        .cl-item.unread .cl-name { font-weight: 800; }
        .cl-item.unread .cl-preview { color: var(--text); font-weight: 600; }
        .cl-item.unread .cl-time { color: var(--primary); font-weight: 700; }
        .cl-overdue-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--danger); color: var(--on-primary); white-space: nowrap; }
        .cl-item.overdue { background: rgba(229,62,62,0.06); box-shadow: inset 3px 0 0 var(--danger); }
        .cl-item.overdue:hover { background: rgba(229,62,62,0.1); }
      `}</style>
    </div>
  )
}

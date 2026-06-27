import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getConversations, getTags, getAgents } from '../hooks/useApi'
import { Search, RefreshCw, UserCheck, Tag as TagIcon, ChevronDown, Clock } from 'lucide-react'

// KPI response time: customer harus dibalas dalam 5 menit
const RESPONSE_KPI_MS = 5 * 60 * 1000

function waitMinutes(awaitingSince, now) {
  if (!awaitingSince) return 0
  return Math.floor((now - new Date(awaitingSince).getTime()) / 60000)
}

const AVATAR_COLORS = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
function avatarStyle(name) {
  const letter = (name || '?')[0].toUpperCase()
  const c = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  return { background: c + '22', color: c }
}

function timeStr(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export default function InboxPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState([])
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all') // all | unread | unreplied | replied
  const [agents, setAgents] = useState([])
  const [agentFilter, setAgentFilter] = useState(null)
  const [showAgentFilter, setShowAgentFilter] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { newMessages, assignmentUpdates, socketConnected } = useSocket()
  const [refreshing, setRefreshing] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const matchChat = useMatch('/chat/:id')
  const activeChatId = matchChat?.params?.id

  const fetch = useCallback(async () => {
    try {
      // agent biasa hanya lihat chat miliknya; admin bisa filter per agent
      const agentId = user?.role === 'agent' ? user.id : agentFilter
      const data = await getConversations(agentId)
      setConversations(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false) }
  }, [user, agentFilter])

  useEffect(() => { fetch() }, [fetch])

  // Refetch saat socket reconnect (menyusul update yang terlewat saat offline)
  const wasConnectedRef = useRef(socketConnected)
  useEffect(() => {
    if (socketConnected && !wasConnectedRef.current) fetch()
    wasConnectedRef.current = socketConnected
  }, [socketConnected, fetch])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try { await fetch() } finally { setTimeout(() => setRefreshing(false), 400) }
  }, [refreshing, fetch])

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

    let needFetch = false
    setConversations(prev => {
      let list = prev
      for (const evt of fresh) {
        const cid = String(evt.conversationId ?? evt.message?.conversation_id ?? '')
        if (!cid) continue
        const idx = list.findIndex(c => String(c.id) === cid)
        if (idx === -1) { needFetch = true; continue }
        const msg = evt.message || {}
        const fromMe = !!msg.from_me
        const ts = msg.timestamp || new Date().toISOString()
        const updated = {
          ...list[idx],
          lastMessage: msg.body ?? list[idx].lastMessage,
          lastMessageAt: ts,
          lastFromMe: fromMe,
          unread: fromMe ? false : (String(activeChatId) !== cid),
          awaitingSince: fromMe ? null : (list[idx].awaitingSince || ts),
        }
        list = [updated, ...list.slice(0, idx), ...list.slice(idx + 1)]
      }
      return list
    })
    if (needFetch) fetch()
  }, [newMessages, fetch, activeChatId])

  // Auto-assign realtime: update badge agent tanpa refresh
  const processedAssignRef = useRef(null)
  useEffect(() => {
    if (processedAssignRef.current === null) { processedAssignRef.current = assignmentUpdates.length; return }
    const fresh = assignmentUpdates.slice(processedAssignRef.current)
    processedAssignRef.current = assignmentUpdates.length
    if (!fresh.length) return
    let needFetch = false
    setConversations(prev => {
      let list = prev
      for (const evt of fresh) {
        const cid = String(evt.conversationId ?? '')
        const idx = list.findIndex(c => String(c.id) === cid)
        if (idx === -1) { needFetch = true; continue }
        list = list.map((c, i) => i === idx ? { ...c, agents: evt.agent, assigned_to: evt.agent?.id } : c)
      }
      return list
    })
    // Agent: chat yang baru di-assign ke dirinya mungkin belum ada di daftar
    if (needFetch && user?.role === 'agent') fetch()
  }, [assignmentUpdates, fetch, user])

  useEffect(() => { getTags().then(d => setTags(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
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

  const isFail = (c) => (c.tags || []).some(t => (t.name || '').toLowerCase() === 'fail')
  // Chat overdue = customer menunggu > 5 menit & belum dibalas, kecuali yang sudah ditandai "fail"
  const isOverdue = (c) => !!c.awaitingSince && c.lastFromMe === false && !isFail(c) &&
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
    return matchesSearch && matchesTag && matchesStatus
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

  const STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'unread', label: 'Belum Dibaca' },
    { key: 'unreplied', label: 'Belum Dibalas' },
    { key: 'replied', label: 'Sudah Dibalas' },
  ]

  return (
    <div className="cl-root" onClick={() => { if (showTagFilter) setShowTagFilter(false); if (showAgentFilter) setShowAgentFilter(false) }}>
      {/* Header */}
      <div className="cl-header">
        <div className="cl-header-top">
          <h2>Chats</h2>
          <button className="cl-icon-btn" onClick={handleRefresh} disabled={refreshing} title="Refresh">
            <RefreshCw size={15} className={refreshing ? 'cl-spin' : ''} />
          </button>
        </div>
        {/* Search */}
        <div className="cl-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Status filter chips */}
        <div className="cl-statusfilter-row">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              className={`cl-statuschip${statusFilter === f.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>
        {/* Tag + Agent filter */}
        <div className="cl-tagfilter-row" onClick={e => e.stopPropagation()}>
          <div className="cv-dd">
            <button className={`cl-tagfilter-btn${activeTagFilter ? ' active' : ''}`} onClick={() => { setShowTagFilter(s => !s); setShowAgentFilter(false) }}>
              <TagIcon size={13} />
              <span>{activeTagFilter ? (tags.find(t => t.id === activeTagFilter)?.name || 'Tag') : 'Semua Tag'}</span>
              <ChevronDown size={12} />
            </button>
            {showTagFilter && (
              <div className="cv-menu" style={{ minWidth: 160 }}>
                <button className={`cv-mi${!activeTagFilter ? ' active' : ''}`} onClick={() => { setActiveTagFilter(null); setShowTagFilter(false) }}>
                  Semua Tag
                </button>
                {tags.map(t => (
                  <button key={t.id} className={`cv-mi${activeTagFilter === t.id ? ' active' : ''}`} onClick={() => { setActiveTagFilter(t.id); setShowTagFilter(false) }}>
                    <span className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="cv-dd">
              <button className={`cl-tagfilter-btn${agentFilter ? ' active' : ''}`} onClick={() => { setShowAgentFilter(s => !s); setShowTagFilter(false) }}>
                <UserCheck size={13} />
                <span>{agentFilter ? (agents.find(a => a.id === agentFilter)?.name || 'Agent') : 'Semua Agent'}</span>
                <ChevronDown size={12} />
              </button>
              {showAgentFilter && (
                <div className="cv-menu" style={{ minWidth: 180 }}>
                  <button className={`cv-mi${!agentFilter ? ' active' : ''}`} onClick={() => { setAgentFilter(null); setShowAgentFilter(false) }}>
                    Semua Agent
                  </button>
                  {agents.map(a => (
                    <button key={a.id} className={`cv-mi${agentFilter === a.id ? ' active' : ''}`} onClick={() => { setAgentFilter(a.id); setShowAgentFilter(false) }}>
                      {a.name}
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
          [...Array(6)].map((_, i) => (
            <div key={i} className="cl-skel" style={{ animationDelay: `${i * 0.06}s` }} />
          ))
        ) : sorted.length === 0 ? (
          <div className="cl-empty">
            {search || statusFilter !== 'all' || activeTagFilter || agentFilter ? 'Tidak ditemukan' : 'Belum ada percakapan'}
          </div>
        ) : (
          sorted.map(conv => {
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
                <div
                  className="cl-avatar"
                  style={isActive ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : avatarStyle(name)}
                >{initial}</div>
                <div className="cl-info">
                  <div className="cl-row">
                    <span className="cl-name">{name}</span>
                    <span className="cl-row-right">
                      {overdue && (
                        <span className="cl-overdue-badge" title={`Belum dibalas ${waitMins} menit (lewat KPI 5 menit)`}>
                          <Clock size={10} />{waitMins}m
                        </span>
                      )}
                      {isUnread && <span className="cl-unread-dot" />}
                      <span className="cl-time">{timeStr(conv.lastMessageAt || conv.updated_at)}</span>
                    </span>
                  </div>
                  <div className="cl-row">
                    <span className="cl-preview">{preview}</span>
                    {isAdmin && assignedAgent && (
                      <span className="cl-agent-badge" title={assignedAgent.name}>
                        <UserCheck size={9} />{agentLabel}
                      </span>
                    )}
                  </div>
                  {conv.tags?.length > 0 && (
                    <div className="cl-tags-row">
                      {conv.tags.slice(0, 3).map(t => (
                        <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .cl-root {
          display: flex; flex-direction: column;
          width: 100%; height: 100%;
          background: #fff; overflow: hidden;
        }
        .cl-header {
          padding: 18px 16px 0;
          border-bottom: 1px solid #e4eaf5;
          flex-shrink: 0;
        }
        .cl-header-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .cl-header-top h2 { font-size: 18px; font-weight: 700; color: #1a2540; }
        .cl-icon-btn {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #a8b8d0; transition: all 0.15s;
        }
        .cl-icon-btn:hover { background: #f0f3fa; color: #4f607a; }
        .cl-icon-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cl-spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cl-search {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; margin-bottom: 12px;
          background: #f7f9fd; border: 1px solid #e4eaf5;
          border-radius: 10px;
        }
        .cl-search svg { color: #a8b8d0; flex-shrink: 0; }
        .cl-search input {
          background: none; border: none; outline: none;
          color: #1a2540; font-size: 13px; width: 100%;
        }
        .cl-search input::placeholder { color: #b8c8d8; }
        .cl-list { flex: 1; min-height: 0; overflow-y: auto; }
        .cl-skel {
          height: 64px; margin: 4px 12px; border-radius: 10px;
          background: #f0f3fa; animation: pulse 1.4s ease infinite;
        }
        .cl-empty {
          text-align: center; padding: 48px 20px;
          color: #a8b8d0; font-size: 13px;
        }
        .cl-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; cursor: pointer;
          border-bottom: 1px solid #f4f6fb;
          transition: background 0.1s;
        }
        .cl-item:hover { background: #f7f9fd; }
        .cl-item.active { background: #3563e9; }
        .cl-item.active .cl-name { color: #fff; }
        .cl-item.active .cl-time { color: rgba(255,255,255,0.7); }
        .cl-item.active .cl-preview { color: rgba(255,255,255,0.75); }
        .cl-item.active .cl-agent-badge {
          background: rgba(255,255,255,0.18); color: #fff;
        }
        .cl-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; flex-shrink: 0;
        }
        .cl-info { flex: 1; min-width: 0; }
        .cl-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 6px; margin-bottom: 3px;
        }
        .cl-row:last-child { margin-bottom: 0; }
        .cl-name { font-size: 14px; font-weight: 600; color: #1a2540; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .cl-time { font-size: 11px; color: #a8b8d0; flex-shrink: 0; }
        .cl-preview { font-size: 12px; color: #8a9bb8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .cl-agent-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 20px;
          background: rgba(39,168,122,0.1); color: #27a87a;
          white-space: nowrap; flex-shrink: 0;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 768px) { .cl-root { width: 100vw; } }
        .cl-tagfilter-row { display: flex; padding: 10px 0; }
        .cv-dd { position: relative; }
        .cl-tagfilter-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; color: #4f607a; background: #f7f9fd; border: 1px solid #e4eaf5; transition: all 0.15s; }
        .cl-tagfilter-btn:hover { background: #eef4fd; }
        .cl-tagfilter-btn.active { color: #3563e9; border-color: #c8d4ec; background: #eef4fd; }
        .cv-menu { position: absolute; left: 0; top: calc(100% + 6px); background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; z-index: 200; box-shadow: 0 8px 24px rgba(26,37,64,0.10); overflow: hidden; }
        .cv-mi { display: flex; align-items: center; width: 100%; text-align: left; padding: 9px 14px; font-size: 13px; color: #1a2540; transition: background 0.1s; }
        .cv-mi:hover { background: #f7f9fd; }
        .cv-mi.active { background: rgba(53,99,233,0.06); color: #3563e9; }
        .cl-tags-row { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
        .tag-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: #fff; white-space: nowrap; }
        .cl-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cl-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #3563e9; flex-shrink: 0; }
        .cl-item.unread .cl-name { font-weight: 800; color: #0d1730; }
        .cl-item.unread .cl-preview { color: #1a2540; font-weight: 600; }
        .cl-statusfilter-row { display: flex; gap: 6px; padding: 0 0 4px; overflow-x: auto; scrollbar-width: none; }
        .cl-statusfilter-row::-webkit-scrollbar { display: none; }
        .cl-statuschip { flex-shrink: 0; padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 500; color: #4f607a; background: #f7f9fd; border: 1px solid #e4eaf5; white-space: nowrap; transition: all 0.15s; }
        .cl-statuschip:hover { background: #eef4fd; }
        .cl-statuschip.active { background: #3563e9; color: #fff; border-color: #3563e9; }
        .cl-tagfilter-row { gap: 8px; }
        .cl-overdue-badge { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; background: #e53e3e; color: #fff; white-space: nowrap; }
        .cl-item.overdue { background: rgba(229,62,62,0.05); box-shadow: inset 3px 0 0 #e53e3e; }
        .cl-item.overdue:hover { background: rgba(229,62,62,0.09); }
        .cl-item.active .cl-overdue-badge { background: #fff; color: #e53e3e; }
      `}</style>
    </div>
  )
}

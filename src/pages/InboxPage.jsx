import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getConversations } from '../hooks/useApi'
import { Search, RefreshCw, UserCheck } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'open', label: 'Aktif' },
  { id: 'in_progress', label: 'Diproses' },
  { id: 'resolved', label: 'Selesai' },
]

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
  const [activeTab, setActiveTab] = useState('all')
  const { newMessages } = useSocket()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const matchChat = useMatch('/chat/:id')
  const activeChatId = matchChat?.params?.id

  const fetch = useCallback(async () => {
    try {
      const agentId = user?.role === 'agent' ? user.id : null
      const data = await getConversations(agentId)
      setConversations(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { if (newMessages.length > 0) fetch() }, [newMessages, fetch])

  const filtered = conversations.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      c.contact?.name?.toLowerCase().includes(q) ||
      c.contact?.phone?.includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })

  return (
    <div className="cl-root">
      {/* Header */}
      <div className="cl-header">
        <div className="cl-header-top">
          <h2>Chats</h2>
          <button className="cl-icon-btn" onClick={fetch} title="Refresh">
            <RefreshCw size={15} />
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
        {/* Tabs */}
        <div className="cl-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`cl-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="cl-list">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="cl-skel" style={{ animationDelay: `${i * 0.06}s` }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="cl-empty">
            {search ? 'Tidak ditemukan' : 'Belum ada percakapan'}
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = String(conv.id) === String(activeChatId)
            const name = conv.contact?.name || conv.contact?.phone || 'Unknown'
            const initial = name[0].toUpperCase()
            const preview = conv.lastMessage || 'Belum ada pesan'
            const assignedAgent = conv.agents
            const agentLabel = assignedAgent?.name?.length > 12
              ? assignedAgent.name.slice(0, 12) + '…'
              : assignedAgent?.name

            return (
              <div
                key={conv.id}
                className={`cl-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                <div
                  className="cl-avatar"
                  style={isActive ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : avatarStyle(name)}
                >{initial}</div>
                <div className="cl-info">
                  <div className="cl-row">
                    <span className="cl-name">{name}</span>
                    <span className="cl-time">{timeStr(conv.lastMessageAt || conv.updated_at)}</span>
                  </div>
                  <div className="cl-row">
                    <span className="cl-preview">{preview}</span>
                    {isAdmin && assignedAgent && (
                      <span className="cl-agent-badge" title={assignedAgent.name}>
                        <UserCheck size={9} />{agentLabel}
                      </span>
                    )}
                  </div>
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
        .cl-tabs {
          display: flex; gap: 2px;
          overflow-x: auto;
          padding-bottom: 0;
        }
        .cl-tabs::-webkit-scrollbar { display: none; }
        .cl-tab {
          padding: 8px 14px;
          font-size: 13px; font-weight: 500;
          color: #8a9bb8; border-radius: 0;
          border-bottom: 2px solid transparent;
          transition: all 0.15s; white-space: nowrap;
          margin-bottom: -1px;
        }
        .cl-tab:hover { color: #3563e9; }
        .cl-tab.active {
          color: #3563e9; font-weight: 600;
          border-bottom-color: #3563e9;
        }
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
      `}</style>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getConversations } from '../hooks/useApi'
import { Search, RefreshCw, UserCheck } from 'lucide-react'

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

function statusColor(s) {
  if (s === 'resolved') return '#00a884'
  if (s === 'in_progress') return '#ffa929'
  return '#53bdeb'
}

export default function InboxPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.contact?.name?.toLowerCase().includes(q) ||
      c.contact?.phone?.includes(q) ||
      c.lastMessage?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="chat-list">
      <div className="cl-header">
        <h2>Chats</h2>
        <div className="cl-header-right">
          {user?.role && (
            <span className="cl-role">{isAdmin ? 'Admin' : user.name || 'Agent'}</span>
          )}
          <button className="cl-icon-btn" onClick={fetch} title="Refresh">
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      <div className="cl-search">
        <Search size={15} />
        <input
          type="text"
          placeholder="Search or start new chat"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="cl-list">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="cl-skel" style={{ animationDelay: `${i * 0.06}s` }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="cl-empty">
            {search ? 'No results found' : user?.role === 'agent' ? 'No conversations assigned to you' : 'No conversations yet'}
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = String(conv.id) === String(activeChatId)
            const name = conv.contact?.name || conv.contact?.phone || 'Unknown'
            const initial = name[0].toUpperCase()
            const preview = conv.lastMessage || 'No messages yet'
            const assignedAgent = conv.agents

            return (
              <div
                key={conv.id}
                className={`cl-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                <div className="cl-avatar">{initial}</div>
                <div className="cl-info">
                  <div className="cl-row">
                    <span className="cl-name">{name}</span>
                    <span className="cl-time">{timeStr(conv.lastMessageAt || conv.updated_at)}</span>
                  </div>
                  <div className="cl-row">
                    <span className="cl-preview">{preview}</span>
                    <div className="cl-badges">
                      {isAdmin && assignedAgent && (
                        <span className="cl-agent-badge" title={`Assigned to ${assignedAgent.name}`}>
                          <UserCheck size={10} />
                          {assignedAgent.name}
                        </span>
                      )}
                      {isAdmin && !assignedAgent && (
                        <span className="cl-unassigned">—</span>
                      )}
                      <span className="cl-dot" style={{ background: statusColor(conv.status) }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .chat-list {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-height: 0;        /* izinkan flex item menyusut */
          background: #111b21;
          overflow: hidden;
        }
        .cl-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; background: #202c33;
          flex-shrink: 0;       /* header tidak boleh menyusut */
        }
        .cl-header h2 { font-size: 20px; font-weight: 600; color: #e9edef; }
        .cl-header-right { display: flex; align-items: center; gap: 10px; }
        .cl-role {
          font-size: 11px; font-weight: 600;
          padding: 2px 10px; border-radius: 12px;
          background: rgba(0,168,132,0.15); color: #00a884;
        }
        .cl-icon-btn {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #8696a0; transition: all 0.15s;
        }
        .cl-icon-btn:hover { background: #2a3942; color: #e9edef; }
        .cl-search {
          display: flex; align-items: center; gap: 10px;
          margin: 8px 10px; padding: 8px 14px;
          background: #2a3942; border-radius: 8px;
          flex-shrink: 0;       /* search bar tidak boleh menyusut */
        }
        .cl-search svg { color: #8696a0; flex-shrink: 0; }
        .cl-search input {
          background: none; border: none; outline: none;
          color: #e9edef; font-size: 14px; width: 100%; padding: 0;
        }
        .cl-search input::placeholder { color: #8696a0; }
        .cl-list {
          flex: 1;
          min-height: 0;        /* PENTING: izinkan scroll tanpa mendorong header */
          overflow-y: auto;
        }
        .cl-skel {
          height: 72px; background: rgba(255,255,255,0.03);
          animation: pulse 1.5s ease infinite;
          border-bottom: 1px solid rgba(34,45,52,0.4);
        }
        .cl-empty {
          text-align: center; padding: 60px 20px;
          color: #8696a0; font-size: 14px; line-height: 1.6;
        }
        .cl-item {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 20px; cursor: pointer;
          border-bottom: 1px solid rgba(34,45,52,0.6);
          transition: background 0.1s;
        }
        .cl-item:hover { background: #1f2c33; }
        .cl-item.active { background: #2a3942; }
        .cl-avatar {
          width: 49px; height: 49px; border-radius: 50%;
          background: #6b7c85;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 400; color: white; flex-shrink: 0;
        }
        .cl-info { flex: 1; min-width: 0; }
        .cl-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px; margin-bottom: 4px;
        }
        .cl-row:last-child { margin-bottom: 0; }
        .cl-name {
          font-size: 15px; font-weight: 400; color: #e9edef;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
        }
        .cl-time { font-size: 12px; color: #8696a0; flex-shrink: 0; }
        .cl-preview {
          font-size: 13px; color: #8696a0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
        }
        .cl-badges { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cl-agent-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 10px; font-weight: 600;
          padding: 1px 6px; border-radius: 8px;
          background: rgba(0,168,132,0.15); color: #00a884;
          white-space: nowrap; max-width: 80px;
          overflow: hidden; text-overflow: ellipsis;
        }
        .cl-unassigned { font-size: 12px; color: #667781; }
        .cl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 768px) {
          .chat-list { width: 100vw; }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getConversations } from '../hooks/useApi'
import { Search, RefreshCw } from 'lucide-react'

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
  if (s === 'resolved') return '#10b981'
  if (s === 'in_progress') return '#f59e0b'
  return '#2563eb'
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
    <div className="cl-root">
      <div className="cl-header">
        <div>
          <h2>Pesan</h2>
          {user?.role && <span className="cl-role">{isAdmin ? 'Admin' : user.name || 'Agent'}</span>}
        </div>
        <button className="cl-icon-btn" onClick={fetch} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="cl-search">
        <Search size={15} />
        <input
          type="text"
          placeholder="Cari percakapan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="cl-list">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="cl-skel" style={{ animationDelay: `${i * 0.06}s` }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="cl-empty">
            {search ? 'Tidak ditemukan' : user?.role === 'agent' ? 'Belum ada percakapan yang di-assign' : 'Belum ada percakapan'}
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = String(conv.id) === String(activeChatId)
            const name = conv.contact?.name || conv.contact?.phone || 'Unknown'
            const initial = name[0].toUpperCase()
            const preview = conv.lastMessage || 'Belum ada pesan'
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
                        <span className="cl-agent-badge">{assignedAgent.name}</span>
                      )}
                      {isAdmin && !assignedAgent && <span className="cl-unassigned">—</span>}
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
        .cl-root {
          display: flex; flex-direction: column;
          width: 100%; min-height: 0;
          background: #fff; overflow: hidden;
        }
        .cl-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px 12px;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
        }
        .cl-header h2 { font-size: 17px; font-weight: 700; color: #1e293b; }
        .cl-role {
          display: inline-block;
          font-size: 11px; font-weight: 600;
          padding: 2px 8px; border-radius: 20px;
          background: rgba(37,99,235,0.08); color: #2563eb;
          margin-top: 2px;
        }
        .cl-icon-btn {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #94a3b8; transition: all 0.15s;
        }
        .cl-icon-btn:hover { background: #f1f5f9; color: #475569; }
        .cl-search {
          display: flex; align-items: center; gap: 8px;
          margin: 8px 12px; padding: 8px 12px;
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 8px; flex-shrink: 0;
        }
        .cl-search svg { color: #94a3b8; flex-shrink: 0; }
        .cl-search input {
          background: none; border: none; outline: none;
          color: #1e293b; font-size: 13px; width: 100%;
        }
        .cl-search input::placeholder { color: #94a3b8; }
        .cl-list { flex: 1; min-height: 0; overflow-y: auto; }
        .cl-skel {
          height: 68px; margin: 4px 12px; border-radius: 10px;
          background: #f1f5f9; animation: pulse 1.4s ease infinite;
        }
        .cl-empty {
          text-align: center; padding: 48px 20px;
          color: #94a3b8; font-size: 13px;
        }
        .cl-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.1s;
        }
        .cl-item:hover { background: #f8fafc; }
        .cl-item.active { background: rgba(37,99,235,0.06); border-left: 3px solid #2563eb; }
        .cl-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg,#2563eb,#7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; font-weight: 600; color: white; flex-shrink: 0;
        }
        .cl-info { flex: 1; min-width: 0; }
        .cl-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 6px; margin-bottom: 3px;
        }
        .cl-row:last-child { margin-bottom: 0; }
        .cl-name { font-size: 14px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .cl-time { font-size: 11px; color: #94a3b8; flex-shrink: 0; }
        .cl-preview { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .cl-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .cl-agent-badge {
          display: inline-flex; align-items: center;
          font-size: 10px; font-weight: 600;
          padding: 1px 6px; border-radius: 8px;
          background: rgba(16,185,129,0.1); color: #10b981;
          max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cl-unassigned { font-size: 12px; color: #cbd5e1; }
        .cl-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 768px) { .cl-root { width: 100vw; } }
      `}</style>
    </div>
  )
}

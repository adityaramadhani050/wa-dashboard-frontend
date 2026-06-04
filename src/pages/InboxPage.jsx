import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { getConversations } from '../hooks/useApi'
import { Search, RefreshCw, MessageSquare, Clock, User } from 'lucide-react'
import clsx from 'clsx'

function statusLabel(s) {
  if (s === 'in_progress') return 'In Progress'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Open'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function InboxPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const { newMessages } = useSocket()
  const navigate = useNavigate()

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations()
      setConversations(Array.isArray(data) ? data : data?.conversations || [])
      setError('')
    } catch (e) {
      setError('Failed to load conversations. Check backend connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (newMessages.length > 0) fetchConversations()
  }, [newMessages, fetchConversations])

  const filtered = conversations.filter(c => {
    const matchSearch = !search ||
      c.contact?.phone?.includes(search) ||
      c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="inbox-page fade-in">
      <div className="inbox-header">
        <div>
          <h1>Inbox</h1>
          <p>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchConversations}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="inbox-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {['all', 'open', 'in_progress', 'resolved'].map(f => (
            <button
              key={f}
              className={clsx('filter-tab', filter === f && 'active')}
              onClick={() => setFilter(f)}
            >
              {statusLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-list">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={40} />
          <h3>No conversations</h3>
          <p>{search ? 'No results for your search' : 'Conversations will appear here when contacts message you'}</p>
        </div>
      ) : (
        <div className="conversation-list">
          {filtered.map(conv => (
            <div
              key={conv.id || conv._id}
              className={clsx('conv-row', conv.unread && 'unread')}
              onClick={() => navigate(`/chat/${conv.id || conv._id}`)}
            >
              <div className="conv-avatar">
                {(conv.contact?.name || conv.contact?.phone || 'U')[0].toUpperCase()}
                {conv.unread && <span className="unread-dot" />}
              </div>
              <div className="conv-info">
                <div className="conv-top">
                  <span className="conv-name">
                    {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                  </span>
                  <span className="conv-time">
                    <Clock size={11} />
                    {timeAgo(conv.lastMessageAt || conv.updatedAt)}
                  </span>
                </div>
                <div className="conv-bottom">
                  <span className="conv-preview">
                    {conv.lastMessage || 'No messages yet'}
                  </span>
                  <div className="conv-meta">
                    {conv.assignedAgent && (
                      <span className="conv-agent">
                        <User size={10} />
                        {conv.assignedAgent?.name || conv.assignedAgent}
                      </span>
                    )}
                    <span className={`badge badge-${conv.status || 'open'}`}>
                      {statusLabel(conv.status || 'open')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .inbox-page { padding: 28px 24px; max-width: 900px; }
        .inbox-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .inbox-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
        .inbox-header p { color: var(--text-muted); font-size: 13px; }
        .inbox-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .search-box {
          flex: 1;
          min-width: 200px;
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-box svg {
          position: absolute;
          left: 12px;
          color: var(--text-dim);
          pointer-events: none;
        }
        .search-box input { padding-left: 36px; }
        .filter-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px;
        }
        .filter-tab {
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          transition: all 0.15s;
          white-space: nowrap;
        }
        .filter-tab:hover { background: var(--bg-hover); color: var(--text); }
        .filter-tab.active { background: var(--green); color: white; }
        .error-banner {
          background: rgba(255,71,87,0.1);
          border: 1px solid rgba(255,71,87,0.2);
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          color: var(--red);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .loading-list { display: flex; flex-direction: column; gap: 1px; }
        .skeleton-row {
          height: 72px;
          background: var(--bg-card);
          border-radius: var(--radius-sm);
          animation: pulse 1.4s ease infinite;
          margin-bottom: 1px;
        }
        .empty-state {
          text-align: center;
          padding: 64px 20px;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .empty-state h3 { font-size: 17px; font-weight: 600; color: var(--text); }
        .empty-state p { font-size: 13px; max-width: 300px; }
        .conversation-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .conv-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          cursor: pointer;
          transition: background 0.12s;
          border-bottom: 1px solid var(--border);
        }
        .conv-row:last-child { border-bottom: none; }
        .conv-row:hover { background: var(--bg-hover); }
        .conv-row.unread { background: rgba(37,211,102,0.04); }
        .conv-avatar {
          width: 44px;
          height: 44px;
          background: var(--green-dark);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          position: relative;
        }
        .unread-dot {
          width: 10px;
          height: 10px;
          background: var(--green);
          border-radius: 50%;
          border: 2px solid var(--bg-card);
          position: absolute;
          top: 0;
          right: 0;
        }
        .conv-info { flex: 1; min-width: 0; }
        .conv-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .conv-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .conv-time {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: var(--text-dim);
          flex-shrink: 0;
          margin-left: 8px;
        }
        .conv-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .conv-preview {
          font-size: 13px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .conv-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .conv-agent {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: var(--text-dim);
        }
        @media (max-width: 600px) {
          .inbox-page { padding: 16px; }
          .filter-tabs { overflow-x: auto; }
        }
      `}</style>
    </div>
  )
}

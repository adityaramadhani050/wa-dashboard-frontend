import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { getMessages, sendMessage, assignAgent, updateStatus, getConversations, getAgents } from '../hooks/useApi'
import { ArrowLeft, Send, User, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved']

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(s) {
  if (s === 'in_progress') return 'In Progress'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Open'
}

export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [agents, setAgents] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const bottomRef = useRef(null)
  const { newMessages } = useSocket()

  const fetchData = useCallback(async () => {
    try {
      const [msgs, convs] = await Promise.all([
        getMessages(id),
        getConversations(),
      ])
      const msgList = Array.isArray(msgs) ? msgs : msgs?.messages || []
      setMessages(msgList)
      const convList = Array.isArray(convs) ? convs : convs?.conversations || []
      const conv = convList.find(c => String(c.id || c._id) === String(id))
      setConversation(conv || null)
      setError('')
    } catch (e) {
      setError('Failed to load messages.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    getAgents().then(data => setAgents(Array.isArray(data) ? data : [])).catch(() => {})
  }, [fetchData])

  useEffect(() => {
    const relevant = newMessages.filter(m => String(m.conversationId) === String(id))
    if (relevant.length > 0) fetchData()
  }, [newMessages, id, fetchData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const msg = text.trim()
    setText('')
    setSending(true)
    try {
      await sendMessage(id, msg)
      await fetchData()
    } catch (e) {
      const errMsg = e?.response?.data?.error || 'Failed to send message.'
      setError(errMsg)
      setText(msg)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status) => {
    setShowStatusMenu(false)
    try {
      await updateStatus(id, status)
      setConversation(prev => prev ? { ...prev, status } : prev)
    } catch { setError('Failed to update status.') }
  }

  const handleAgentAssign = async (agent) => {
    setShowAgentMenu(false)
    try {
      await assignAgent(id, agent.id)
      setConversation(prev => prev ? { ...prev, agents: agent } : prev)
    } catch { setError('Failed to assign agent.') }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const assignedAgentName = conversation?.agents?.name || null

  return (
    <div className="chat-page fade-in">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/inbox')}>
          <ArrowLeft size={18} />
        </button>
        <div className="chat-contact">
          <div className="chat-avatar">
            {(conversation?.contact?.name || conversation?.contact?.phone || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="chat-name">
              {conversation?.contact?.name || conversation?.contact?.phone || 'Unknown Contact'}
            </div>
            {conversation?.contact?.phone && (
              <div className="chat-phone">{conversation.contact.phone}</div>
            )}
          </div>
        </div>
        <div className="chat-actions">
          <div className="dropdown-wrap">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowAgentMenu(!showAgentMenu); setShowStatusMenu(false) }}
            >
              <User size={14} />
              {assignedAgentName || 'Assign Agent'}
              <ChevronDown size={13} />
            </button>
            {showAgentMenu && (
              <div className="dropdown-menu">
                {agents.length === 0 ? (
                  <div className="dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                    No agents found
                  </div>
                ) : (
                  agents.map(agent => (
                    <button key={agent.id} className="dropdown-item" onClick={() => handleAgentAssign(agent)}>
                      {agent.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="dropdown-wrap">
            <button
              className={`btn badge-${conversation?.status || 'open'}`}
              style={{ borderRadius: 'var(--radius-sm)' }}
              onClick={() => { setShowStatusMenu(!showStatusMenu); setShowAgentMenu(false) }}
            >
              {statusLabel(conversation?.status || 'open')}
              <ChevronDown size={13} />
            </button>
            {showStatusMenu && (
              <div className="dropdown-menu">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    className={clsx('dropdown-item', `status-${s}`)}
                    onClick={() => handleStatusChange(s)}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-messages" onClick={() => { setShowStatusMenu(false); setShowAgentMenu(false) }}>
        {loading ? (
          <div className="loading-msgs">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={clsx('skeleton-bubble', i % 2 === 0 ? 'left' : 'right')} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg, i) => {
            const isSent = msg.from_me === true || msg.from_me === 1 || msg.fromMe === true
            return (
              <div key={msg.id || msg._id || i} className={clsx('msg-wrap', isSent ? 'sent' : 'received')}>
                <div className={clsx('bubble', isSent ? 'bubble-sent' : 'bubble-received')}>
                  <p>{msg.body || msg.content || msg.message || msg.text}</p>
                  <span className="msg-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: 'none' }}
        />
        <button
          className={clsx('send-btn', text.trim() && 'active')}
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .chat-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg);
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .back-btn {
          padding: 8px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          transition: all 0.15s;
        }
        .back-btn:hover { background: var(--bg-hover); color: var(--text); }
        .chat-contact { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .chat-avatar {
          width: 40px;
          height: 40px;
          background: var(--green-dark);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .chat-name { font-size: 15px; font-weight: 600; }
        .chat-phone { font-size: 12px; color: var(--text-muted); }
        .chat-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
        .dropdown-wrap { position: relative; }
        .dropdown-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          min-width: 140px;
          z-index: 100;
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--text);
          transition: background 0.12s;
        }
        .dropdown-item:hover { background: var(--bg-hover); }
        .chat-error {
          background: rgba(255,71,87,0.1);
          color: var(--red);
          padding: 8px 20px;
          font-size: 13px;
          border-bottom: 1px solid rgba(255,71,87,0.2);
          flex-shrink: 0;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .loading-msgs { display: flex; flex-direction: column; gap: 10px; }
        .skeleton-bubble {
          height: 48px;
          border-radius: 16px;
          max-width: 60%;
          background: var(--bg-card);
          animation: pulse 1.4s ease infinite;
        }
        .skeleton-bubble.left { align-self: flex-start; }
        .skeleton-bubble.right { align-self: flex-end; }
        .no-messages {
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
          margin: auto;
        }
        .msg-wrap { display: flex; margin-bottom: 2px; }
        .msg-wrap.sent { justify-content: flex-end; }
        .msg-wrap.received { justify-content: flex-start; }
        .bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 18px;
          position: relative;
        }
        .bubble-sent {
          background: var(--green-dark);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .bubble-received {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text);
          border-bottom-left-radius: 4px;
        }
        .bubble p { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
        .msg-time {
          display: block;
          font-size: 10px;
          margin-top: 4px;
          opacity: 0.65;
          text-align: right;
        }
        .chat-input-area {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding: 12px 16px;
          background: var(--bg-card);
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-input {
          flex: 1;
          max-height: 120px;
          overflow-y: auto;
          border-radius: 20px;
          padding: 10px 16px;
          font-size: 14px;
          line-height: 1.5;
        }
        .send-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--bg-hover);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .send-btn.active { background: var(--green); color: white; }
        .send-btn:disabled { opacity: 0.5; }
        @media (max-width: 600px) {
          .chat-actions { gap: 4px; }
          .chat-header { padding: 10px 12px; }
        }
      `}</style>
    </div>
  )
}

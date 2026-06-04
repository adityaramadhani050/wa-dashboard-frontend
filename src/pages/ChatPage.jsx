import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getMessages, sendMessage, assignAgent, updateStatus, getConversations, getAgents } from '../hooks/useApi'
import { Send, ChevronDown, ArrowLeft, UserCheck } from 'lucide-react'

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved']

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(s) {
  if (s === 'in_progress') return 'In Progress'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Open'
}

function cleanPhone(phone) {
  if (!phone) return ''
  return phone.split('@')[0]
}

function MessageTick({ status }) {
  const isRead = status === 'read'
  const isDelivered = status === 'delivered' || isRead
  const color = isRead ? '#53bdeb' : 'rgba(255,255,255,0.5)'

  if (isDelivered) {
    return (
      <svg width="18" height="12" viewBox="0 0 18 12" fill="none" style={{flexShrink:0}}>
        <path d="M1 6l4 4L13 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 6l4 4 8-8" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0}}>
      <path d="M1 6l3.5 4L11 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function ChatPage({ chatId }) {
  const id = chatId
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

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
      const agentId = user?.role === 'agent' ? user.id : null
      const [msgs, convs] = await Promise.all([getMessages(id), getConversations(agentId)])
      setMessages(Array.isArray(msgs) ? msgs : [])
      const convList = Array.isArray(convs) ? convs : []
      setConversation(convList.find(c => String(c.id) === String(id)) || null)
      setError('')
    } catch { setError('Failed to load messages.') }
    finally { setLoading(false) }
  }, [id, user])

  useEffect(() => {
    fetchData()
    if (isAdmin) getAgents().then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {})
  }, [fetchData, isAdmin])

  useEffect(() => {
    if (newMessages.some(m => String(m.conversationId) === String(id))) fetchData()
  }, [newMessages, id, fetchData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const closeMenus = () => { setShowStatusMenu(false); setShowAgentMenu(false) }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const msg = text.trim()
    setText('')
    setSending(true)
    try { await sendMessage(id, msg); await fetchData() }
    catch (e) { setError(e?.response?.data?.error || 'Failed to send.'); setText(msg) }
    finally { setSending(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleStatusChange = async (status) => {
    closeMenus()
    try { await updateStatus(id, status); setConversation(p => p ? { ...p, status } : p) }
    catch { setError('Failed to update status.') }
  }

  const handleAgentAssign = async (agent) => {
    closeMenus()
    try { await assignAgent(id, agent.id); setConversation(p => p ? { ...p, agents: agent } : p) }
    catch { setError('Failed to assign agent.') }
  }

  const name = conversation?.contact?.name || conversation?.contact?.phone || 'Unknown'
  const phone = cleanPhone(conversation?.contact?.phone)
  const assignedAgent = conversation?.agents
  const status = conversation?.status || 'open'

  return (
    <div className="chat-view" onClick={closeMenus}>
      {/* Header */}
      <div className="cv-header" onClick={e => e.stopPropagation()}>
        <button className="cv-back" onClick={() => navigate('/inbox')}>
          <ArrowLeft size={20} />
        </button>
        <div className="cv-avatar">{name[0].toUpperCase()}</div>
        <div className="cv-contact">
          <div className="cv-name">{name}</div>
          <div className="cv-sub-row">
            {phone && name !== phone && <span className="cv-phone">{phone}</span>}
            {/* Assigned agent badge — visible to admin only */}
            {isAdmin && assignedAgent && (
              <span className="cv-assigned-badge">
                <UserCheck size={11} />
                {assignedAgent.name}
              </span>
            )}
            {isAdmin && !assignedAgent && (
              <span className="cv-unassigned-badge">Unassigned</span>
            )}
          </div>
        </div>

        <div className="cv-actions" onClick={e => e.stopPropagation()}>
          {/* Assign agent — admin only */}
          {isAdmin && (
            <div className="cv-dd">
              <button
                className="cv-icon-btn"
                onClick={() => { setShowAgentMenu(!showAgentMenu); setShowStatusMenu(false) }}
                title="Assign Agent"
              >
                <UserCheck size={18} />
              </button>
              {showAgentMenu && (
                <div className="cv-menu" style={{minWidth:200}}>
                  <div className="cv-menu-label">Assign Agent</div>
                  {agents.length === 0
                    ? <div className="cv-mi muted">No agents available</div>
                    : agents.map(a => (
                      <button
                        key={a.id}
                        className={`cv-mi ${assignedAgent?.id === a.id ? 'active-agent' : ''}`}
                        onClick={() => handleAgentAssign(a)}
                      >
                        <span>{a.name}</span>
                        <span className="cv-mi-sub">{a.email}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Status — visible to everyone */}
          <div className="cv-dd">
            <button
              className={`cv-chip st-${status}`}
              onClick={() => { setShowStatusMenu(!showStatusMenu); setShowAgentMenu(false) }}
            >
              {statusLabel(status)}
              <ChevronDown size={12} />
            </button>
            {showStatusMenu && (
              <div className="cv-menu" style={{minWidth:140}}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} className={`cv-mi si-${s}`} onClick={() => handleStatusChange(s)}>
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="cv-error">
          {error}
          <button onClick={() => setError('')} style={{marginLeft:8,fontWeight:700,fontSize:16}}>×</button>
        </div>
      )}

      {/* Messages */}
      <div className="cv-messages">
        {loading ? (
          <div className="cv-loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`cv-skel ${i % 2 === 0 ? 'left' : 'right'}`} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="cv-empty">No messages yet. Say hello! 👋</div>
        ) : (
          messages.map((msg, i) => {
            const sent = msg.from_me === true || msg.from_me === 1 || msg.fromMe === true
            return (
              <div key={msg.id || i} className={`cv-row ${sent ? 'sent' : 'recv'}`}>
                <div className={`cv-bubble ${sent ? 'bsent' : 'brecv'}`}>
                  <p>{msg.body || msg.content || msg.text}</p>
                  <div className="cv-meta">
                    <span className="cv-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                    {sent && <MessageTick status={msg.status} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="cv-input-bar">
        <textarea
          className="cv-input"
          placeholder="Type a message"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className={`cv-send-btn ${text.trim() ? 'ready' : ''}`}
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          <Send size={20} />
        </button>
      </div>

      <style>{`
        .chat-view {
          flex: 1; display: flex; flex-direction: column;
          height: 100vh; min-width: 0; background: #0b141a;
        }
        .cv-header {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 16px;
          background: #202c33;
          border-bottom: 1px solid #222d34;
          flex-shrink: 0; min-height: 60px;
        }
        .cv-back {
          display: none; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%;
          color: #8696a0; transition: all 0.15s;
        }
        .cv-back:hover { background: #2a3942; color: #e9edef; }
        @media (max-width: 768px) { .cv-back { display: flex; } }
        .cv-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          background: #6b7c85;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 500; color: white; flex-shrink: 0;
        }
        .cv-contact { flex: 1; min-width: 0; }
        .cv-name { font-size: 15px; font-weight: 500; color: #e9edef; }
        .cv-sub-row {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; margin-top: 1px;
        }
        .cv-phone { font-size: 12px; color: #8696a0; }
        .cv-assigned-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 600;
          padding: 1px 8px; border-radius: 10px;
          background: rgba(0,168,132,0.15); color: #00a884;
        }
        .cv-unassigned-badge {
          font-size: 11px; font-weight: 500;
          padding: 1px 8px; border-radius: 10px;
          background: rgba(255,169,41,0.12); color: #ffa929;
        }
        .cv-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 20px;
          font-size: 12px; font-weight: 600; transition: opacity 0.15s;
        }
        .cv-chip:hover { opacity: 0.8; }
        .cv-chip.st-open { background: rgba(83,189,235,0.15); color: #53bdeb; }
        .cv-chip.st-in_progress { background: rgba(255,169,41,0.15); color: #ffa929; }
        .cv-chip.st-resolved { background: rgba(0,168,132,0.15); color: #00a884; }
        .cv-icon-btn {
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #8696a0; transition: all 0.15s;
        }
        .cv-icon-btn:hover { background: #2a3942; color: #e9edef; }
        .cv-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          background: #233138; border: 1px solid #2a3942;
          border-radius: 8px; z-index: 200;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5); overflow: hidden;
        }
        .cv-menu-label {
          padding: 8px 16px 4px;
          font-size: 11px; font-weight: 600; color: #8696a0;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .cv-mi {
          display: flex; flex-direction: column;
          width: 100%; text-align: left;
          padding: 10px 16px; font-size: 14px; color: #e9edef;
          transition: background 0.1s;
        }
        .cv-mi:hover { background: #2a3942; }
        .cv-mi.muted { color: #8696a0; cursor: default; }
        .cv-mi.active-agent { background: rgba(0,168,132,0.1); color: #00a884; }
        .cv-mi-sub { font-size: 11px; color: #8696a0; margin-top: 1px; }
        .si-open { color: #53bdeb !important; }
        .si-in_progress { color: #ffa929 !important; }
        .si-resolved { color: #00a884 !important; }
        .cv-error {
          background: rgba(241,92,109,0.1);
          border-bottom: 1px solid rgba(241,92,109,0.2);
          color: #f15c6d; padding: 8px 16px; font-size: 13px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .cv-messages {
          flex: 1; overflow-y: auto;
          padding: 12px 6%;
          display: flex; flex-direction: column; gap: 2px;
          background-color: #0b141a;
          background-image: url("data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M150 0l150 150-150 150L0 150z'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 150px;
        }
        .cv-loading { display: flex; flex-direction: column; gap: 10px; }
        .cv-skel {
          height: 44px; max-width: 58%; border-radius: 10px;
          background: rgba(255,255,255,0.05);
          animation: pulse 1.4s ease infinite;
        }
        .cv-skel.left { align-self: flex-start; }
        .cv-skel.right { align-self: flex-end; }
        .cv-empty {
          margin: auto; color: #8696a0; font-size: 14px;
          text-align: center; padding: 32px;
          background: rgba(0,0,0,0.25); border-radius: 8px;
        }
        .cv-row { display: flex; margin-bottom: 2px; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        .cv-bubble {
          max-width: 65%;
          padding: 6px 12px 8px;
          border-radius: 8px; position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.4);
          word-break: break-word;
        }
        .bsent { background: #005c4b; color: #e9edef; border-bottom-right-radius: 2px; }
        .brecv { background: #202c33; color: #e9edef; border-bottom-left-radius: 2px; }
        .cv-bubble p { font-size: 14.2px; line-height: 1.5; white-space: pre-wrap; }
        .cv-meta {
          display: flex; align-items: center;
          justify-content: flex-end; gap: 4px; margin-top: 3px;
        }
        .cv-time { font-size: 11px; color: rgba(255,255,255,0.45); white-space: nowrap; }
        .cv-input-bar {
          display: flex; align-items: flex-end; gap: 10px;
          padding: 10px 16px; background: #202c33; flex-shrink: 0;
        }
        .cv-input {
          flex: 1; background: #2a3942; border: none; border-radius: 8px;
          color: #e9edef; padding: 10px 16px; font-size: 15px;
          line-height: 1.4; outline: none; resize: none;
          max-height: 140px; overflow-y: auto;
        }
        .cv-input::placeholder { color: #8696a0; }
        .cv-send-btn {
          width: 44px; height: 44px; border-radius: 50%;
          background: #374a52; color: #8696a0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cv-send-btn.ready { background: #00a884; color: white; }
        .cv-send-btn:disabled { opacity: 0.6; }
      `}</style>
    </div>
  )
}

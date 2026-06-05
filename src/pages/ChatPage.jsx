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
  const color = isRead ? '#60a5fa' : 'rgba(255,255,255,0.6)'
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
    } catch { setError('Gagal memuat pesan.') }
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
    catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim.'); setText(msg) }
    finally { setSending(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleStatusChange = async (status) => {
    closeMenus()
    try { await updateStatus(id, status); setConversation(p => p ? { ...p, status } : p) }
    catch { setError('Gagal update status.') }
  }

  const handleAgentAssign = async (agent) => {
    closeMenus()
    try { await assignAgent(id, agent.id); setConversation(p => p ? { ...p, agents: agent } : p) }
    catch { setError('Gagal assign agent.') }
  }

  const name = conversation?.contact?.name || conversation?.contact?.phone || 'Unknown'
  const phone = cleanPhone(conversation?.contact?.phone)
  const assignedAgent = conversation?.agents
  const status = conversation?.status || 'open'

  return (
    <div className="cv-root" onClick={closeMenus}>
      {/* Header */}
      <div className="cv-header" onClick={e => e.stopPropagation()}>
        <button className="cv-back" onClick={() => navigate('/inbox')}><ArrowLeft size={20} /></button>
        <div className="cv-avatar">{name[0].toUpperCase()}</div>
        <div className="cv-contact">
          <div className="cv-name">{name}</div>
          <div className="cv-sub">
            {phone && name !== phone && <span className="cv-phone">{phone}</span>}
            {isAdmin && assignedAgent && (
              <span className="cv-assigned"><UserCheck size={10} />{assignedAgent.name}</span>
            )}
            {isAdmin && !assignedAgent && <span className="cv-unassigned">Unassigned</span>}
          </div>
        </div>
        <div className="cv-actions" onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <div className="cv-dd">
              <button className="cv-icon-btn" onClick={() => { setShowAgentMenu(!showAgentMenu); setShowStatusMenu(false) }} title="Assign Agent">
                <UserCheck size={17} />
              </button>
              {showAgentMenu && (
                <div className="cv-menu" style={{minWidth:200}}>
                  <div className="cv-menu-lbl">Assign Agent</div>
                  {agents.length === 0
                    ? <div className="cv-mi muted">Tidak ada agent</div>
                    : agents.map(a => (
                      <button key={a.id} className={`cv-mi${assignedAgent?.id === a.id ? ' active' : ''}`} onClick={() => handleAgentAssign(a)}>
                        <span>{a.name}</span><span className="cv-mi-sub">{a.email}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
          <div className="cv-dd">
            <button className={`cv-chip st-${status}`} onClick={() => { setShowStatusMenu(!showStatusMenu); setShowAgentMenu(false) }}>
              {statusLabel(status)}<ChevronDown size={11} />
            </button>
            {showStatusMenu && (
              <div className="cv-menu" style={{minWidth:140}}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} className={`cv-mi si-${s}`} onClick={() => handleStatusChange(s)}>{statusLabel(s)}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="cv-error">
          {error}<button onClick={() => setError('')} style={{marginLeft:8,fontWeight:700}}>×</button>
        </div>
      )}

      {/* Messages */}
      <div className="cv-messages">
        {loading ? (
          <div className="cv-loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`cv-skel ${i%2===0?'left':'right'}`} style={{animationDelay:`${i*0.1}s`}} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="cv-empty">Belum ada pesan. Sapa dulu! 👋</div>
        ) : (
          messages.map((msg, i) => {
            const sent = msg.from_me === true || msg.from_me === 1 || msg.fromMe === true
            return (
              <div key={msg.id || i} className={`cv-row ${sent?'sent':'recv'}`}>
                <div className={`cv-bubble ${sent?'bsent':'brecv'}`}>
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
          placeholder="Ketik pesan..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className={`cv-send ${text.trim()?'ready':''}`} onClick={handleSend} disabled={!text.trim()||sending}>
          <Send size={19} />
        </button>
      </div>

      <style>{`
        .cv-root {
          flex: 1; display: flex; flex-direction: column;
          min-height: 0; min-width: 0;
          background: #f8fafc; overflow: hidden;
        }
        .cv-header {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0; min-height: 60px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .cv-back {
          display: none; width: 36px; height: 36px; border-radius: 8px;
          align-items: center; justify-content: center;
          color: #64748b; transition: all 0.15s; flex-shrink: 0;
        }
        .cv-back:hover { background: #f1f5f9; }
        @media (max-width: 768px) { .cv-back { display: flex; } }
        .cv-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg,#2563eb,#7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600; color: white; flex-shrink: 0;
        }
        .cv-contact { flex: 1; min-width: 0; }
        .cv-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .cv-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 1px; }
        .cv-phone { font-size: 12px; color: #94a3b8; }
        .cv-assigned {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; font-weight: 600;
          padding: 1px 7px; border-radius: 10px;
          background: rgba(16,185,129,0.1); color: #10b981;
        }
        .cv-unassigned {
          font-size: 11px; padding: 1px 7px; border-radius: 10px;
          background: rgba(245,158,11,0.1); color: #f59e0b;
        }
        .cv-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 600; transition: opacity 0.15s;
          border: 1.5px solid transparent;
        }
        .cv-chip:hover { opacity: 0.8; }
        .cv-chip.st-open { background: rgba(37,99,235,0.08); color: #2563eb; border-color: rgba(37,99,235,0.2); }
        .cv-chip.st-in_progress { background: rgba(245,158,11,0.08); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .cv-chip.st-resolved { background: rgba(16,185,129,0.08); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .cv-icon-btn {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #64748b; transition: all 0.15s;
        }
        .cv-icon-btn:hover { background: #f1f5f9; color: #1e293b; }
        .cv-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 10px; z-index: 200;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1); overflow: hidden;
        }
        .cv-menu-lbl {
          padding: 8px 14px 4px;
          font-size: 10px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .cv-mi {
          display: flex; flex-direction: column;
          width: 100%; text-align: left;
          padding: 9px 14px; font-size: 13px; color: #1e293b;
          transition: background 0.1s;
        }
        .cv-mi:hover { background: #f8fafc; }
        .cv-mi.muted { color: #94a3b8; cursor: default; }
        .cv-mi.active { background: rgba(16,185,129,0.06); color: #10b981; }
        .cv-mi-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .si-open { color: #2563eb !important; }
        .si-in_progress { color: #f59e0b !important; }
        .si-resolved { color: #10b981 !important; }
        .cv-error {
          background: rgba(239,68,68,0.06); border-bottom: 1px solid rgba(239,68,68,0.15);
          color: #ef4444; padding: 8px 16px; font-size: 13px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        /* Messages */
        .cv-messages {
          flex: 1; min-height: 0; overflow-y: auto;
          padding: 16px 20px;
          display: flex; flex-direction: column; gap: 2px;
          background: #f0f4f8;
        }
        .cv-loading { display: flex; flex-direction: column; gap: 8px; }
        .cv-skel {
          height: 42px; max-width: 55%; border-radius: 10px;
          background: rgba(0,0,0,0.06); animation: pulse 1.4s ease infinite;
        }
        .cv-skel.left { align-self: flex-start; }
        .cv-skel.right { align-self: flex-end; }
        .cv-empty {
          margin: auto; color: #94a3b8; font-size: 14px;
          text-align: center; padding: 32px;
        }
        .cv-row { display: flex; margin-bottom: 2px; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        .cv-bubble {
          max-width: 65%; padding: 8px 12px 6px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          word-break: break-word;
        }
        .bsent { background: #2563eb; color: #fff; border-bottom-right-radius: 4px; }
        .brecv { background: #fff; color: #1e293b; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }
        .cv-bubble p { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
        .cv-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 3px; }
        .cv-time { font-size: 10px; color: rgba(255,255,255,0.6); white-space: nowrap; }
        .brecv .cv-time { color: #94a3b8; }
        /* Input */
        .cv-input-bar {
          display: flex; align-items: flex-end; gap: 10px;
          padding: 10px 14px;
          background: #fff; border-top: 1px solid #e2e8f0;
          flex-shrink: 0;
        }
        .cv-input {
          flex: 1; background: #f8fafc;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          color: #1e293b; padding: 10px 14px; font-size: 14px;
          line-height: 1.4; outline: none; resize: none;
          max-height: 130px; overflow-y: auto;
          transition: border-color 0.15s;
        }
        .cv-input:focus { border-color: #2563eb; }
        .cv-input::placeholder { color: #94a3b8; }
        .cv-send {
          width: 42px; height: 42px; border-radius: 10px;
          background: #e2e8f0; color: #94a3b8;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cv-send.ready { background: #2563eb; color: white; }
        .cv-send:disabled { opacity: 0.5; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

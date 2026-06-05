import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getMessages, sendMessage, sendMedia, assignAgent, updateStatus, getConversations, getAgents } from '../hooks/useApi'
import { Send, ChevronDown, ArrowLeft, UserCheck, Paperclip, X, FileText, Play, Download, Check, Image, Film } from 'lucide-react'

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved']

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hari ini'
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getDateKey(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toDateString()
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

function DateSeparator({ label }) {
  return (
    <div className="cv-date-sep">
      <span>{label}</span>
    </div>
  )
}

// Image with error fallback
function ImgMedia({ url, filename, caption, sent, onImageClick }) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!url || error) {
    return (
      <a
        href={url || '#'}
        target="_blank"
        rel="noreferrer"
        className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}
      >
        <Image size={28} strokeWidth={1.5} />
        <div className="cv-media-broken-info">
          <span>Foto</span>
          <span className="cv-media-broken-sub">Tap untuk buka</span>
        </div>
        <Download size={16} className="cv-media-broken-dl" />
      </a>
    )
  }

  return (
    <div className="cv-media-wrap">
      {!loaded && (
        <div className="cv-media-skeleton">
          <div className="cv-media-skel-inner" />
        </div>
      )}
      <img
        src={url}
        className="cv-media-img"
        alt="foto"
        style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        onClick={() => onImageClick(url)}
      />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

// Video with error fallback
function VideoMedia({ url, filename, caption, sent }) {
  const [error, setError] = useState(false)

  if (!url || error) {
    return (
      <a
        href={url || '#'}
        target="_blank"
        rel="noreferrer"
        className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}
      >
        <Film size={28} strokeWidth={1.5} />
        <div className="cv-media-broken-info">
          <span>Video</span>
          <span className="cv-media-broken-sub">Tap untuk buka</span>
        </div>
        <Download size={16} className="cv-media-broken-dl" />
      </a>
    )
  }

  return (
    <div className="cv-media-wrap">
      <video
        src={url}
        controls
        className="cv-media-video"
        onError={() => setError(true)}
      />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

// Document with download animation
function DocMedia({ url, filename, sent }) {
  const [dlStatus, setDlStatus] = useState('idle') // idle | downloading | done

  const handleClick = () => {
    if (dlStatus !== 'idle') return
    setDlStatus('downloading')
    setTimeout(() => setDlStatus('done'), 2200)
  }

  const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE'

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename}
      className={`cv-media-doc ${sent ? 'sent' : 'recv'}`}
      onClick={handleClick}
    >
      <div className="cv-media-doc-icon-wrap">
        {dlStatus === 'idle' && (
          <div className="cv-media-doc-icon">
            <FileText size={22} />
            <span className="cv-media-doc-ext">{ext}</span>
          </div>
        )}
        {dlStatus === 'downloading' && (
          <div className="cv-media-doc-icon dl-active">
            <div className="cv-dl-ring" />
            <Download size={14} className="cv-dl-icon" />
          </div>
        )}
        {dlStatus === 'done' && (
          <div className="cv-media-doc-icon dl-done">
            <Check size={20} />
          </div>
        )}
      </div>
      <div className="cv-media-doc-info">
        <span className="cv-media-doc-name">{filename || 'Download file'}</span>
        <span className="cv-media-doc-sub">
          {dlStatus === 'idle' && 'Tap untuk unduh'}
          {dlStatus === 'downloading' && 'Mengunduh...'}
          {dlStatus === 'done' && 'Terunduh ✓'}
        </span>
      </div>
    </a>
  )
}

function MediaContent({ msg, sent, onImageClick }) {
  const { media_type, media_url, media_filename, body } = msg
  const caption = body && !body.startsWith('[') ? body : null

  if (!media_url && !media_type) {
    return <p>{msg.body || msg.content || msg.text}</p>
  }

  if (media_type === 'image') {
    return <ImgMedia url={media_url} filename={media_filename} caption={caption} sent={sent} onImageClick={onImageClick} />
  }

  if (media_type === 'video') {
    return <VideoMedia url={media_url} filename={media_filename} caption={caption} sent={sent} />
  }

  if (media_type === 'audio') {
    return (
      <div className="cv-media-audio-wrap">
        <audio src={media_url} controls className="cv-media-audio" />
      </div>
    )
  }

  if (media_type === 'document') {
    return <DocMedia url={media_url} filename={media_filename} sent={sent} />
  }

  return (
    <div className="cv-media-placeholder">
      <Paperclip size={16} />
      <span>{media_filename || body || '[media]'}</span>
    </div>
  )
}

function ImageLightbox({ url, onClose }) {
  if (!url) return null
  return (
    <div className="cv-lightbox" onClick={onClose}>
      <button className="cv-lightbox-close" onClick={onClose}><X size={24} /></button>
      <img src={url} className="cv-lightbox-img" onClick={e => e.stopPropagation()} alt="preview" />
    </div>
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
  const [selectedFile, setSelectedFile] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
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
    if (isAdmin) {
      getAgents()
        .then(d => setAgents(Array.isArray(d) ? d.filter(a => a.role === 'agent') : []))
        .catch(() => {})
    }
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    const previewUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null
    setSelectedFile({ file, previewUrl, type: isImage ? 'image' : isVideo ? 'video' : 'document' })
    e.target.value = ''
  }

  const handleSendMedia = async () => {
    if (!selectedFile || sending) return
    setSending(true)
    const f = selectedFile
    setSelectedFile(null)
    try {
      await sendMedia(id, f.file, text.trim() || undefined)
      setText('')
      await fetchData()
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal mengirim file.')
      setSelectedFile(f)
    } finally { setSending(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      selectedFile ? handleSendMedia() : handleSend()
    }
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

  const messageItems = []
  let lastDateKey = null
  for (const msg of messages) {
    const ts = msg.timestamp || msg.createdAt
    const dk = getDateKey(ts)
    if (dk && dk !== lastDateKey) {
      messageItems.push({ type: 'date', key: dk, label: formatDateLabel(ts) })
      lastDateKey = dk
    }
    messageItems.push({ type: 'msg', msg })
  }

  return (
    <div className="cv-root" onClick={closeMenus}>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

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
              <button
                className="cv-assign-btn"
                onClick={() => { setShowAgentMenu(!showAgentMenu); setShowStatusMenu(false) }}
              >
                <UserCheck size={15} />
                Assign
              </button>
              {showAgentMenu && (
                <div className="cv-menu" style={{minWidth:200}}>
                  <div className="cv-menu-lbl">Assign ke Agent</div>
                  {agents.length === 0
                    ? <div className="cv-mi muted">Tidak ada agent</div>
                    : agents.map(a => (
                      <button key={a.id} className={`cv-mi${assignedAgent?.id === a.id ? ' active' : ''}`} onClick={() => handleAgentAssign(a)}>
                        <span>{a.name}</span>
                        <span className="cv-mi-sub">{a.username ? `@${a.username}` : a.email}</span>
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
          messageItems.map((item, i) => {
            if (item.type === 'date') {
              return <DateSeparator key={item.key} label={item.label} />
            }
            const msg = item.msg
            const sent = msg.from_me === true || msg.from_me === 1 || msg.fromMe === true
            const hasMedia = !!msg.media_type
            return (
              <div key={msg.id || i} className={`cv-row ${sent?'sent':'recv'}`}>
                <div className={`cv-bubble ${sent?'bsent':'brecv'} ${hasMedia?'media':''}`}>
                  {hasMedia ? (
                    <MediaContent msg={msg} sent={sent} onImageClick={setLightboxUrl} />
                  ) : (
                    <p>{msg.body || msg.content || msg.text}</p>
                  )}
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

      {/* File preview bar */}
      {selectedFile && (
        <div className="cv-file-preview" onClick={e => e.stopPropagation()}>
          <div className="cv-file-preview-content">
            {selectedFile.type === 'image' && (
              <img src={selectedFile.previewUrl} className="cv-file-thumb" alt="preview" />
            )}
            {selectedFile.type === 'video' && (
              <div className="cv-file-thumb cv-file-video-thumb">
                <Play size={20} color="white" />
              </div>
            )}
            {selectedFile.type === 'document' && (
              <div className="cv-file-thumb cv-file-doc-thumb">
                <FileText size={20} color="#2563eb" />
              </div>
            )}
            <span className="cv-file-name">{selectedFile.file.name}</span>
          </div>
          <button className="cv-file-remove" onClick={() => setSelectedFile(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="cv-input-bar" onClick={e => e.stopPropagation()}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
          onChange={handleFileSelect}
        />
        <button
          className="cv-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Lampirkan file"
        >
          <Paperclip size={20} />
        </button>
        <textarea
          className="cv-input"
          placeholder={selectedFile ? 'Tambah keterangan (opsional)...' : 'Ketik pesan...'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className={`cv-send ${(text.trim() || selectedFile) ? 'ready' : ''}`}
          onClick={selectedFile ? handleSendMedia : handleSend}
          disabled={(!text.trim() && !selectedFile) || sending}
        >
          {sending
            ? <div className="cv-sending-dot" />
            : <Send size={19} />}
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
          padding: 10px 16px; background: #fff;
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
          font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px;
          background: rgba(16,185,129,0.1); color: #10b981;
        }
        .cv-unassigned {
          font-size: 11px; padding: 1px 7px; border-radius: 10px;
          background: rgba(245,158,11,0.1); color: #f59e0b;
        }
        .cv-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-assign-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 8px;
          font-size: 13px; font-weight: 600;
          color: #475569; background: #f1f5f9;
          border: 1px solid #e2e8f0; transition: all 0.15s;
        }
        .cv-assign-btn:hover { background: #e2e8f0; color: #1e293b; }
        .cv-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 600;
          border: 1.5px solid transparent; transition: opacity 0.15s;
        }
        .cv-chip:hover { opacity: 0.8; }
        .cv-chip.st-open { background: rgba(37,99,235,0.08); color: #2563eb; border-color: rgba(37,99,235,0.2); }
        .cv-chip.st-in_progress { background: rgba(245,158,11,0.08); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .cv-chip.st-resolved { background: rgba(16,185,129,0.08); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .cv-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 10px; z-index: 200;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1); overflow: hidden;
        }
        .cv-menu-lbl {
          padding: 8px 14px 4px; font-size: 10px; font-weight: 700;
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .cv-mi {
          display: flex; flex-direction: column; width: 100%; text-align: left;
          padding: 9px 14px; font-size: 13px; color: #1e293b; transition: background 0.1s;
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
        .cv-empty { margin: auto; color: #94a3b8; font-size: 14px; text-align: center; padding: 32px; }
        /* Date separator */
        .cv-date-sep { display: flex; align-items: center; justify-content: center; margin: 10px 0 8px; }
        .cv-date-sep span {
          background: #dce8f5; color: #4a6fa5;
          font-size: 11px; font-weight: 600;
          padding: 4px 12px; border-radius: 20px; letter-spacing: 0.2px;
        }
        /* Bubbles */
        .cv-row { display: flex; margin-bottom: 2px; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        .cv-bubble {
          max-width: 65%; padding: 8px 12px 6px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          word-break: break-word;
        }
        .cv-bubble.media { padding: 4px 4px 6px; }
        .bsent { background: #2563eb; color: #fff; border-bottom-right-radius: 4px; }
        .brecv { background: #fff; color: #1e293b; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }
        .cv-bubble p { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
        .cv-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 3px; padding: 0 4px; }
        .cv-time { font-size: 10px; color: rgba(255,255,255,0.6); white-space: nowrap; }
        .brecv .cv-time { color: #94a3b8; }
        /* Media base */
        .cv-media-wrap { min-width: 180px; }
        /* Image */
        .cv-media-skeleton {
          width: 240px; height: 160px; border-radius: 8px;
          background: rgba(0,0,0,0.08); overflow: hidden;
        }
        .cv-media-skel-inner {
          width: 100%; height: 100%;
          background: linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.3) 50%,transparent 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .cv-media-img {
          width: 100%; max-width: 280px; border-radius: 8px;
          display: block; cursor: zoom-in; object-fit: cover;
          transition: opacity 0.15s;
        }
        .cv-media-img:hover { opacity: 0.92; }
        /* Video */
        .cv-media-video {
          width: 100%; max-width: 280px; border-radius: 8px; display: block;
        }
        /* Audio */
        .cv-media-audio-wrap { padding: 4px 0; }
        .cv-media-audio { width: 220px; height: 36px; }
        /* Caption */
        .cv-media-caption { font-size: 13px; padding: 6px 4px 0; line-height: 1.4; }
        /* Broken media fallback */
        .cv-media-broken {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 10px; text-decoration: none;
          min-width: 180px; transition: opacity 0.15s;
        }
        .cv-media-broken:hover { opacity: 0.85; }
        .cv-media-broken.sent { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cv-media-broken.recv { background: #f0f4f8; color: #475569; border: 1px solid #e2e8f0; }
        .cv-media-broken-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .cv-media-broken-info span { font-size: 13px; font-weight: 600; }
        .cv-media-broken-sub { font-size: 11px; opacity: 0.65; font-weight: 400 !important; }
        .cv-media-broken-dl { opacity: 0.6; flex-shrink: 0; }
        /* Document */
        .cv-media-doc {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 10px; text-decoration: none;
          min-width: 200px; transition: opacity 0.15s; cursor: pointer;
        }
        .cv-media-doc:hover { opacity: 0.88; }
        .cv-media-doc.sent { background: rgba(255,255,255,0.15); color: #fff; }
        .cv-media-doc.recv { background: #f0f4f8; color: #1e293b; border: 1px solid #e2e8f0; }
        .cv-media-doc-icon-wrap { flex-shrink: 0; }
        .cv-media-doc-icon {
          width: 42px; height: 42px; border-radius: 10px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 1px; position: relative;
        }
        .bsent .cv-media-doc-icon { background: rgba(255,255,255,0.18); color: #fff; }
        .brecv .cv-media-doc-icon { background: #dbeafe; color: #2563eb; }
        .cv-media-doc-ext {
          font-size: 8px; font-weight: 800; letter-spacing: 0.3px;
          text-transform: uppercase; line-height: 1;
        }
        .cv-media-doc-icon.dl-active {
          position: relative;
        }
        .bsent .cv-media-doc-icon.dl-active { background: rgba(255,255,255,0.18); color: #fff; }
        .brecv .cv-media-doc-icon.dl-active { background: #dbeafe; color: #2563eb; }
        .cv-dl-ring {
          position: absolute; inset: 3px;
          border-radius: 50%;
          border: 2.5px solid transparent;
          border-top-color: currentColor;
          animation: spin 0.8s linear infinite;
        }
        .cv-dl-icon { position: relative; z-index: 1; }
        .cv-media-doc-icon.dl-done {
          animation: popIn 0.3s ease;
        }
        .bsent .cv-media-doc-icon.dl-done { background: rgba(16,185,129,0.25); color: #6ee7b7; }
        .brecv .cv-media-doc-icon.dl-done { background: rgba(16,185,129,0.12); color: #10b981; }
        .cv-media-doc-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        .cv-media-doc-name {
          font-size: 13px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 180px;
        }
        .cv-media-doc-sub { font-size: 11px; opacity: 0.65; }
        /* Placeholder */
        .cv-media-placeholder {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; opacity: 0.7; padding: 4px;
        }
        /* File preview bar */
        .cv-file-preview {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 14px; background: #eff6ff;
          border-top: 1px solid #bfdbfe; flex-shrink: 0;
        }
        .cv-file-preview-content { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .cv-file-thumb {
          width: 44px; height: 44px; border-radius: 6px;
          object-fit: cover; flex-shrink: 0;
        }
        .cv-file-video-thumb {
          background: #1e293b; display: flex;
          align-items: center; justify-content: center;
        }
        .cv-file-doc-thumb {
          background: #eff6ff; border: 1px solid #bfdbfe;
          display: flex; align-items: center; justify-content: center;
        }
        .cv-file-name {
          font-size: 13px; font-weight: 500; color: #1e293b;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 200px;
        }
        .cv-file-remove {
          width: 28px; height: 28px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: #94a3b8; flex-shrink: 0;
        }
        .cv-file-remove:hover { background: #dbeafe; color: #2563eb; }
        /* Input */
        .cv-input-bar {
          display: flex; align-items: flex-end; gap: 8px;
          padding: 10px 14px; background: #fff;
          border-top: 1px solid #e2e8f0; flex-shrink: 0;
        }
        .cv-attach-btn {
          width: 42px; height: 42px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #94a3b8; transition: all 0.15s; flex-shrink: 0;
        }
        .cv-attach-btn:hover { background: #f1f5f9; color: #2563eb; }
        .cv-input {
          flex: 1; background: #f8fafc;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          color: #1e293b; padding: 10px 14px; font-size: 14px;
          line-height: 1.4; outline: none; resize: none;
          max-height: 130px; overflow-y: auto; transition: border-color 0.15s;
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
        .cv-sending-dot {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          animation: spin 0.7s linear infinite;
        }
        /* Lightbox */
        .cv-lightbox {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.88);
          display: flex; align-items: center; justify-content: center;
        }
        .cv-lightbox-close {
          position: absolute; top: 16px; right: 16px;
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          color: white; transition: background 0.15s;
        }
        .cv-lightbox-close:hover { background: rgba(255,255,255,0.25); }
        .cv-lightbox-img {
          max-width: 90vw; max-height: 90vh;
          border-radius: 8px; object-fit: contain;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes popIn { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}

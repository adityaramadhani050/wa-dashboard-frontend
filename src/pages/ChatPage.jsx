import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { getMessages, sendMessage, sendMedia, assignAgent, updateStatus, getConversations, getAgents } from '../hooks/useApi'
import { supabase } from '../lib/supabase'
import { Send, ChevronDown, ArrowLeft, UserCheck, Paperclip, X, FileText, Play, Download, Check, Image, Film, Clock } from 'lucide-react'

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
  if (s === 'in_progress') return 'Diproses'
  if (s === 'resolved') return 'Selesai'
  return 'Aktif'
}

function cleanPhone(phone) {
  if (!phone) return ''
  return phone.split('@')[0]
}

function isFromMe(msg) {
  return msg.from_me === true || msg.from_me === 1 || msg.fromMe === true
}

function MessageTick({ status }) {
  const isRead = status === 'read'
  const isDelivered = status === 'delivered' || isRead
  const color = isRead ? '#a0c8f0' : 'rgba(255,255,255,0.55)'
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
  return <div className="cv-date-sep"><span>{label}</span></div>
}

function ImgMedia({ url, caption, sent, onImageClick }) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  if (!url || error) {
    return (
      <a href={url || '#'} target="_blank" rel="noreferrer" className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}>
        <Image size={26} strokeWidth={1.5} />
        <div className="cv-media-broken-info"><span>Foto</span><span className="cv-media-broken-sub">Tap untuk buka</span></div>
        <Download size={15} />
      </a>
    )
  }
  return (
    <div className="cv-media-wrap">
      {!loaded && <div className="cv-media-skeleton"><div className="cv-media-skel-inner" /></div>}
      <img src={url} className="cv-media-img" alt="foto"
        style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)} onError={() => setError(true)}
        onClick={() => onImageClick(url)} />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function VideoMedia({ url, caption, sent }) {
  const [error, setError] = useState(false)
  if (!url || error) {
    return (
      <a href={url || '#'} target="_blank" rel="noreferrer" className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}>
        <Film size={26} strokeWidth={1.5} />
        <div className="cv-media-broken-info"><span>Video</span><span className="cv-media-broken-sub">Tap untuk buka</span></div>
        <Download size={15} />
      </a>
    )
  }
  return (
    <div className="cv-media-wrap">
      <video src={url} controls className="cv-media-video" onError={() => setError(true)} />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function DocMedia({ url, filename, sent }) {
  const [dlStatus, setDlStatus] = useState('idle')
  const handleClick = () => { if (dlStatus !== 'idle') return; setDlStatus('downloading'); setTimeout(() => setDlStatus('done'), 2200) }
  const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE'
  return (
    <a href={url} target="_blank" rel="noreferrer" download={filename}
      className={`cv-media-doc ${sent ? 'sent' : 'recv'}`} onClick={handleClick}>
      <div className="cv-media-doc-icon-wrap">
        {dlStatus === 'idle' && <div className="cv-media-doc-icon"><FileText size={22} /><span className="cv-media-doc-ext">{ext}</span></div>}
        {dlStatus === 'downloading' && <div className="cv-media-doc-icon dl-active"><div className="cv-dl-ring" /><Download size={14} className="cv-dl-icon" /></div>}
        {dlStatus === 'done' && <div className="cv-media-doc-icon dl-done"><Check size={20} /></div>}
      </div>
      <div className="cv-media-doc-info">
        <span className="cv-media-doc-name">{filename || 'Download file'}</span>
        <span className="cv-media-doc-sub">{dlStatus === 'idle' ? 'Tap untuk unduh' : dlStatus === 'downloading' ? 'Mengunduh...' : 'Terunduh ✓'}</span>
      </div>
    </a>
  )
}

function MediaContent({ msg, sent, onImageClick }) {
  const { media_type, media_url, media_filename, body } = msg
  const caption = body && !body.startsWith('[') ? body : null
  if (!media_url && !media_type) return <p>{msg.body || msg.content || msg.text}</p>
  if (media_type === 'image') return <ImgMedia url={media_url} caption={caption} sent={sent} onImageClick={onImageClick} />
  if (media_type === 'video') return <VideoMedia url={media_url} caption={caption} sent={sent} />
  if (media_type === 'audio') return <div className="cv-media-audio-wrap"><audio src={media_url} controls className="cv-media-audio" /></div>
  if (media_type === 'document') return <DocMedia url={media_url} filename={media_filename} sent={sent} />
  return <div className="cv-media-placeholder"><Paperclip size={16} /><span>{media_filename || body || '[media]'}</span></div>
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

// Merge incoming message into state: replace first tmp- if from_me, else append
function mergeMessage(prev, message) {
  if (!message?.id) return prev
  if (prev.some(m => String(m.id) === String(message.id))) return prev
  if (isFromMe(message)) {
    const tmpIdx = prev.findIndex(m => String(m.id).startsWith('tmp-'))
    if (tmpIdx !== -1) {
      const next = [...prev]
      next[tmpIdx] = message
      return next
    }
  }
  return [...prev, message]
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
  const { newMessages, statusUpdates } = useSocket()

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
    if (isAdmin) getAgents().then(d => setAgents(Array.isArray(d) ? d.filter(a => a.role === 'agent') : [])).catch(() => {})
  }, [fetchData, isAdmin])

  useEffect(() => {
    if (!supabase || !id) return
    const channel = supabase
      .channel(`messages:conv:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, ({ new: msg }) => {
        setMessages(prev => mergeMessage(prev, msg))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  useEffect(() => {
    const relevant = newMessages.filter(m => String(m.conversationId) === String(id))
    if (!relevant.length) return
    setMessages(prev => {
      let next = prev
      for (const { message } of relevant) next = mergeMessage(next, message)
      return next
    })
  }, [newMessages, id])

  useEffect(() => {
    if (!statusUpdates.length) return
    setMessages(prev => prev.map(msg => {
      const upd = statusUpdates.find(u => String(u.messageId) === String(msg.id))
      return upd ? { ...msg, status: upd.status } : msg
    }))
  }, [statusUpdates])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const closeMenus = () => { setShowStatusMenu(false); setShowAgentMenu(false) }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const msg = text.trim()
    setText('')
    setSending(true)
    const tempId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, body: msg, from_me: true,
      timestamp: new Date().toISOString(), status: 'sending',
    }])
    try {
      await sendMessage(id, msg)
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal mengirim.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(msg)
    } finally { setSending(false) }
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
    try { await sendMedia(id, f.file, text.trim() || undefined); setText(''); await fetchData() }
    catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim file.'); setSelectedFile(f) }
    finally { setSending(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectedFile ? handleSendMedia() : handleSend() }
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
    if (dk && dk !== lastDateKey) { messageItems.push({ type: 'date', key: dk, label: formatDateLabel(ts) }); lastDateKey = dk }
    messageItems.push({ type: 'msg', msg })
  }

  return (
    <div className="cv-root" onClick={closeMenus}>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      <div className="cv-header" onClick={e => e.stopPropagation()}>
        <button className="cv-back" onClick={() => navigate('/inbox')}><ArrowLeft size={20} /></button>
        <div className="cv-avatar">{name[0].toUpperCase()}</div>
        <div className="cv-contact">
          <div className="cv-name">{name}</div>
          <div className="cv-sub">
            {phone && name !== phone && <span className="cv-phone">{phone}</span>}
            {isAdmin && assignedAgent && <span className="cv-assigned"><UserCheck size={10} />{assignedAgent.name}</span>}
            {isAdmin && !assignedAgent && <span className="cv-unassigned">Unassigned</span>}
          </div>
        </div>
        <div className="cv-actions" onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <div className="cv-dd">
              <button className="cv-assign-btn" onClick={() => { setShowAgentMenu(!showAgentMenu); setShowStatusMenu(false) }}>
                <UserCheck size={15} /><span className="cv-btn-label">Assign</span>
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
            <button className={`cv-status-btn st-${status}`} onClick={() => { setShowStatusMenu(!showStatusMenu); setShowAgentMenu(false) }}>
              <span className="cv-status-dot" /><span className="cv-btn-label">{statusLabel(status)}</span><ChevronDown size={12} />
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
            if (item.type === 'date') return <DateSeparator key={item.key} label={item.label} />
            const msg = item.msg
            const sent = isFromMe(msg)
            const hasMedia = !!msg.media_type
            const isSending = String(msg.id).startsWith('tmp-')
            return (
              <div key={msg.id || i} className={`cv-row ${sent?'sent':'recv'}`}>
                <div className={`cv-bubble ${sent?'bsent':'brecv'} ${hasMedia?'media':''} ${isSending?'sending':''}`}>
                  {hasMedia
                    ? <MediaContent msg={msg} sent={sent} onImageClick={setLightboxUrl} />
                    : <p>{msg.body || msg.content || msg.text}</p>
                  }
                  <div className="cv-meta">
                    {isSending
                      ? <Clock size={11} style={{color:'rgba(255,255,255,0.5)',flexShrink:0}} />
                      : <span className="cv-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
                    }
                    {sent && !isSending && <MessageTick status={msg.status} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {selectedFile && (
        <div className="cv-file-preview" onClick={e => e.stopPropagation()}>
          <div className="cv-file-preview-content">
            {selectedFile.type === 'image' && <img src={selectedFile.previewUrl} className="cv-file-thumb" alt="preview" />}
            {selectedFile.type === 'video' && <div className="cv-file-thumb cv-file-video-thumb"><Play size={18} color="white" /></div>}
            {selectedFile.type === 'document' && <div className="cv-file-thumb cv-file-doc-thumb"><FileText size={18} color="#3563e9" /></div>}
            <span className="cv-file-name">{selectedFile.file.name}</span>
          </div>
          <button className="cv-file-remove" onClick={() => setSelectedFile(null)}><X size={15} /></button>
        </div>
      )}

      <div className="cv-input-bar" onClick={e => e.stopPropagation()}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
          onChange={handleFileSelect} />
        <button className="cv-attach-btn" onClick={() => fileInputRef.current?.click()} title="Lampirkan file">
          <Paperclip size={19} />
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
          className={`cv-send-btn ${(text.trim() || selectedFile) && !sending ? 'ready' : ''}`}
          onClick={selectedFile ? handleSendMedia : handleSend}
          disabled={(!text.trim() && !selectedFile) || sending}
        >
          {sending
            ? <div className="cv-sending-dot" />
            : <><span className="cv-send-label">Kirim</span><Send size={15} /></>}
        </button>
      </div>

      <style>{`
        .cv-root { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: #f0f3fa; overflow: hidden; }
        .cv-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e4eaf5; flex-shrink: 0; min-height: 64px; }
        .cv-back { display: none; width: 36px; height: 36px; border-radius: 8px; align-items: center; justify-content: center; color: #8a9bb8; flex-shrink: 0; }
        .cv-back:hover { background: #f0f3fa; }
        @media (max-width: 768px) { .cv-back { display: flex; } }
        .cv-avatar { width: 40px; height: 40px; border-radius: 50%; background: #dce8fb; color: #3563e9; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex-shrink: 0; }
        .cv-contact { flex: 1; min-width: 0; overflow: hidden; }
        .cv-name { font-size: 14px; font-weight: 600; color: #1a2540; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 1px; }
        .cv-phone { font-size: 12px; color: #a8b8d0; }
        .cv-assigned { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: rgba(39,168,122,0.1); color: #27a87a; }
        .cv-unassigned { font-size: 11px; padding: 1px 7px; border-radius: 10px; background: rgba(208,139,40,0.1); color: #d08b28; }
        .cv-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-assign-btn { display: flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #4f607a; background: #f0f3fa; border: 1px solid #e4eaf5; transition: all 0.15s; }
        .cv-assign-btn:hover { background: #e8eef8; }
        .cv-status-btn { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; border: 1px solid #e4eaf5; background: #f7f9fd; color: #4f607a; transition: all 0.15s; }
        .cv-status-btn:hover { background: #e8eef8; }
        .cv-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .st-open .cv-status-dot { background: #3563e9; }
        .st-in_progress .cv-status-dot { background: #d08b28; }
        .st-resolved .cv-status-dot { background: #27a87a; }
        .cv-menu { position: absolute; right: 0; top: calc(100% + 6px); background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; z-index: 200; box-shadow: 0 8px 24px rgba(26,37,64,0.10); overflow: hidden; }
        .cv-menu-lbl { padding: 8px 14px 4px; font-size: 10px; font-weight: 700; color: #a8b8d0; text-transform: uppercase; letter-spacing: 0.5px; }
        .cv-mi { display: flex; flex-direction: column; width: 100%; text-align: left; padding: 9px 14px; font-size: 13px; color: #1a2540; transition: background 0.1s; }
        .cv-mi:hover { background: #f7f9fd; }
        .cv-mi.muted { color: #a8b8d0; cursor: default; }
        .cv-mi.active { background: rgba(39,168,122,0.06); color: #27a87a; }
        .cv-mi-sub { font-size: 11px; color: #a8b8d0; margin-top: 1px; }
        .si-open { color: #3563e9 !important; }
        .si-in_progress { color: #d08b28 !important; }
        .si-resolved { color: #27a87a !important; }
        .cv-error { background: rgba(229,62,62,0.05); border-bottom: 1px solid rgba(229,62,62,0.12); color: #c44; padding: 8px 16px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .cv-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 2px; background: #f0f3fa; }
        .cv-loading { display: flex; flex-direction: column; gap: 8px; }
        .cv-skel { height: 40px; max-width: 55%; border-radius: 10px; background: rgba(0,0,0,0.05); animation: pulse 1.4s ease infinite; }
        .cv-skel.left { align-self: flex-start; }
        .cv-skel.right { align-self: flex-end; }
        .cv-empty { margin: auto; color: #a8b8d0; font-size: 14px; text-align: center; padding: 32px; }
        .cv-date-sep { display: flex; align-items: center; justify-content: center; margin: 12px 0 8px; }
        .cv-date-sep span { background: #dce8fb; color: #5a7ab5; font-size: 11px; font-weight: 600; padding: 4px 14px; border-radius: 20px; }
        .cv-row { display: flex; margin-bottom: 3px; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        .cv-bubble { max-width: 62%; padding: 10px 14px 7px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); word-break: break-word; }
        .cv-bubble.media { padding: 4px 4px 7px; }
        .cv-bubble.sending { opacity: 0.65; }
        .bsent { background: #3563e9; color: #fff; border-bottom-right-radius: 4px; }
        .brecv { background: #fff; color: #1a2540; border-bottom-left-radius: 4px; border: 1px solid #e4eaf5; }
        .cv-bubble p { font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
        .cv-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; padding: 0 2px; }
        .cv-time { font-size: 10px; color: rgba(255,255,255,0.6); white-space: nowrap; }
        .brecv .cv-time { color: #a8b8d0; }
        .cv-media-wrap { min-width: 180px; }
        .cv-media-skeleton { width: 240px; height: 160px; border-radius: 8px; background: rgba(0,0,0,0.06); overflow: hidden; }
        .cv-media-skel-inner { width: 100%; height: 100%; background: linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.4) 50%,transparent 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        .cv-media-img { width: 100%; max-width: 280px; border-radius: 8px; display: block; cursor: zoom-in; object-fit: cover; }
        .cv-media-video { width: 100%; max-width: 280px; border-radius: 8px; display: block; }
        .cv-media-audio-wrap { padding: 4px 0; }
        .cv-media-audio { width: 220px; height: 36px; }
        .cv-media-caption { font-size: 13px; padding: 6px 4px 0; line-height: 1.4; }
        .cv-media-broken { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; text-decoration: none; min-width: 180px; }
        .cv-media-broken.sent { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cv-media-broken.recv { background: #f0f3fa; color: #4f607a; border: 1px solid #e4eaf5; }
        .cv-media-broken-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .cv-media-broken-info span { font-size: 13px; font-weight: 600; }
        .cv-media-broken-sub { font-size: 11px; opacity: 0.65; font-weight: 400 !important; }
        .cv-media-doc { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; text-decoration: none; min-width: 200px; cursor: pointer; }
        .cv-media-doc.sent { background: rgba(255,255,255,0.15); color: #fff; }
        .cv-media-doc.recv { background: #f0f3fa; color: #1a2540; border: 1px solid #e4eaf5; }
        .cv-media-doc-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; position: relative; }
        .bsent .cv-media-doc-icon { background: rgba(255,255,255,0.18); color: #fff; }
        .brecv .cv-media-doc-icon { background: #dce8fb; color: #3563e9; }
        .cv-media-doc-ext { font-size: 8px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; }
        .cv-dl-ring { position: absolute; inset: 3px; border-radius: 50%; border: 2.5px solid transparent; border-top-color: currentColor; animation: spin 0.8s linear infinite; }
        .cv-dl-icon { position: relative; z-index: 1; }
        .bsent .cv-media-doc-icon.dl-done { background: rgba(39,168,122,0.25); color: #6ee7c7; }
        .brecv .cv-media-doc-icon.dl-done { background: rgba(39,168,122,0.12); color: #27a87a; }
        .cv-media-doc-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        .cv-media-doc-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .cv-media-doc-sub { font-size: 11px; opacity: 0.65; }
        .cv-media-placeholder { display: flex; align-items: center; gap: 6px; font-size: 13px; opacity: 0.7; padding: 4px; }
        .cv-file-preview { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #eef4fd; border-top: 1px solid #c8d4ec; flex-shrink: 0; }
        .cv-file-preview-content { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .cv-file-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
        .cv-file-video-thumb { background: #1a2540; display: flex; align-items: center; justify-content: center; }
        .cv-file-doc-thumb { background: #eef4fd; border: 1px solid #c8d4ec; display: flex; align-items: center; justify-content: center; }
        .cv-file-name { font-size: 13px; font-weight: 500; color: #1a2540; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .cv-file-remove { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; }
        .cv-file-remove:hover { background: #dce8fb; color: #3563e9; }
        .cv-input-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; border-top: 1px solid #e4eaf5; flex-shrink: 0; }
        .cv-attach-btn { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; border: 1.5px solid #e4eaf5; background: #f7f9fd; }
        .cv-attach-btn:hover { background: #eef4fd; color: #3563e9; border-color: #c8d4ec; }
        .cv-input { flex: 1; background: #f7f9fd; border: 1.5px solid #e4eaf5; border-radius: 12px; color: #1a2540; padding: 0 14px; font-size: 14px; line-height: 44px; height: 44px; outline: none; resize: none; overflow: hidden; transition: border-color 0.15s; font-family: inherit; }
        .cv-input:focus { border-color: #3563e9; background: #fff; }
        .cv-input::placeholder { color: #b8c8d8; }
        .cv-send-btn { display: flex; align-items: center; justify-content: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 12px; flex-shrink: 0; background: #e4eaf5; color: #8a9bb8; font-size: 14px; font-weight: 600; transition: all 0.15s; white-space: nowrap; }
        .cv-send-btn.ready { background: #3563e9; color: #fff; box-shadow: 0 4px 12px rgba(53,99,233,0.28); }
        .cv-send-btn.ready:hover { background: #2850cc; }
        .cv-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cv-sending-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; animation: spin 0.7s linear infinite; }
        .cv-lightbox { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; }
        .cv-lightbox-close { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: white; }
        .cv-lightbox-close:hover { background: rgba(255,255,255,0.25); }
        .cv-lightbox-img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
        @media (max-width: 768px) {
          .cv-header { padding: 10px 12px; gap: 8px; min-height: 56px; }
          .cv-messages { padding: 12px; }
          .cv-bubble { max-width: 78%; }
          .cv-btn-label { display: none; }
          .cv-assign-btn { padding: 8px 10px; }
          .cv-status-btn { padding: 8px 10px; gap: 4px; }
          .cv-send-label { display: none; }
          .cv-send-btn { padding: 0; width: 44px; height: 44px; justify-content: center; border-radius: 12px; }
          .cv-input-bar { padding: 8px 10px; gap: 6px; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes popIn { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}

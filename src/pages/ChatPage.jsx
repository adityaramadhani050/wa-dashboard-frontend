import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import {
  getMessages, sendMessage, sendMedia, assignAgent, unassignAgent, getConversation, getConversations, getAgents,
  forwardMessage, deleteMessage,
  getTemplates, getQuickMedia, sendQuickMedia, useTemplate,
  getTags, addTagToConversation, removeTagFromConversation,
  getContactNotes, createContactNote, createReminder, getContactConversations,
  generateAiSuggestion, suggestAiTags, suggestAiNote, updateContact,
} from '../hooks/useApi'
import { supabase } from '../lib/supabase'
import { Send, ArrowLeft, ArrowDown, UserCheck, Paperclip, X, FileText, Play, Download, Check, Image, Film, Clock, Zap, Package, Tag as TagIcon, StickyNote, BellPlus, MoreVertical, Sparkles, Reply, Pencil, Forward, Search as SearchIcon, Trash2, Copy } from 'lucide-react'


const AVATAR_COLORS = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
function avatarStyle(name) {
  const letter = (name || '?')[0].toUpperCase()
  const c = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  return { background: c + '22', color: c }
}

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
  if (s === 'in_progress') return 'Aktif'
  if (s === 'resolved') return 'Resolved'
  return 'Open'
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

function Modal({ title, onClose, children }) {
  return (
    <div className="cv-modal-overlay" onClick={onClose}>
      <div className="cv-modal" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <h3>{title}</h3>
          <button className="cv-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function formatReminderTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('id', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

function DocMedia({ url, filename, caption, sent }) {
  const [dlStatus, setDlStatus] = useState('idle')
  const handleClick = () => { if (dlStatus !== 'idle') return; setDlStatus('downloading'); setTimeout(() => setDlStatus('done'), 2200) }
  const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE'
  return (
    <div className="cv-media-wrap">
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
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function MediaContent({ msg, sent, onImageClick }) {
  const { media_type, media_url, media_filename, body } = msg
  const caption = body && !body.startsWith('[') ? body : null
  if (!media_url && !media_type) return <p>{msg.body || msg.content || msg.text}</p>
  if (media_type && !media_url) {
    // Media sedang diunduh di server, URL menyusul
    if (media_type === 'image' || media_type === 'video')
      return <div className="cv-media-wrap"><div className="cv-media-skeleton"><div className="cv-media-skel-inner" /></div></div>
    return <div className="cv-media-placeholder"><Paperclip size={16} /><span>Memuat {media_type}…</span></div>
  }
  if (media_type === 'image') return <ImgMedia url={media_url} caption={caption} sent={sent} onImageClick={onImageClick} />
  if (media_type === 'video') return <VideoMedia url={media_url} caption={caption} sent={sent} />
  if (media_type === 'audio') return <div className="cv-media-audio-wrap"><audio src={media_url} controls className="cv-media-audio" />{caption && <p className="cv-media-caption">{caption}</p>}</div>
  if (media_type === 'document') return <DocMedia url={media_url} filename={media_filename} caption={caption} sent={sent} />
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

function mergeMessage(prev, message) {
  if (!message?.id) return prev
  const existingIdx = prev.findIndex(m => String(m.id) === String(message.id))
  if (existingIdx !== -1) {
    // Sudah ada (mis. update media_url menyusul) — gabungkan field non-null saja
    const next = [...prev]
    const merged = { ...next[existingIdx] }
    for (const k in message) { if (message[k] != null) merged[k] = message[k] }
    next[existingIdx] = merged
    return next
  }
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

// Baris pesan dengan gesture geser-untuk-balas (recv: geser kanan, sent: geser kiri)
function SwipeMessageRow({ msg, sent, isSending, hasMedia, hasReply, name, onReply, onForward, onDelete, onMenu, onImageClick }) {
  const [dragX, setDragX] = useState(0)
  const start = useRef(null)
  const swiping = useRef(false)
  const THRESHOLD = 55
  const MAX = 80

  const longPressTimer = useRef(null)
  const longPressed = useRef(false)
  const clearLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }

  const onTouchStart = (e) => {
    if (isSending) return
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    swiping.current = false
    longPressed.current = false
    // Tekan-tahan (±500ms) tanpa menggeser -> buka menu forward
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true
      if (navigator.vibrate) navigator.vibrate(15)
      onMenu()
    }, 500)
  }
  const onTouchMove = (e) => {
    if (!start.current) return
    const t = e.touches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    // gerakan sedikit saja -> batalkan long-press
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress()
    if (!swiping.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) swiping.current = true
      else return
    }
    // recv hanya boleh geser kanan (dx>0), sent hanya geser kiri (dx<0)
    let d = sent ? Math.min(0, dx) : Math.max(0, dx)
    d = Math.max(-MAX, Math.min(MAX, d))
    setDragX(d)
  }
  const onTouchEnd = () => {
    clearLongPress()
    if (!longPressed.current && Math.abs(dragX) >= THRESHOLD && !isSending) onReply()
    setDragX(0)
    start.current = null
    swiping.current = false
  }

  const showCue = Math.abs(dragX) > 12
  return (
    <div
      className={`cv-row ${sent ? 'sent' : 'recv'}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showCue && (
        <span className={`cv-swipe-cue ${sent ? 'right' : 'left'}${Math.abs(dragX) >= THRESHOLD ? ' active' : ''}`}>
          <Reply size={16} />
        </span>
      )}
      {!isSending && (
        <div className="cv-hover-actions">
          <button className="cv-hover-btn" title="Balas" onClick={onReply}><Reply size={14} /></button>
          <button className="cv-hover-btn" title="Teruskan" onClick={onForward}><Forward size={14} /></button>
          <button className="cv-hover-btn danger" title="Hapus" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      )}
      <div
        className={`cv-bubble ${sent ? 'bsent' : 'brecv'} ${hasMedia ? 'media' : ''} ${isSending ? 'sending' : ''}`}
        style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, transition: dragX ? 'none' : 'transform 0.18s ease' }}
      >
        {hasReply && (
          <div className={`cv-quote ${sent ? 'on-sent' : 'on-recv'}`}>
            <span className="cv-quote-who">{msg.reply_to_from_me ? 'Anda' : name}</span>
            <span className="cv-quote-text">{msg.reply_to_body || 'Pesan'}</span>
          </div>
        )}
        {hasMedia
          ? <MediaContent msg={msg} sent={sent} onImageClick={onImageClick} />
          : <p>{msg.body || msg.content || msg.text}</p>
        }
        <div className="cv-meta">
          {isSending
            ? <Clock size={11} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            : <span className="cv-time">{formatTime(msg.timestamp || msg.createdAt)}</span>
          }
          {sent && !isSending && <MessageTick status={msg.status} />}
        </div>
      </div>
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
  const [replyTo, setReplyTo] = useState(null) // { wa_message_id, body, from_me }
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [templates, setTemplates] = useState([])
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [quickMedia, setQuickMedia] = useState([])
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [sendingQuickMediaId, setSendingQuickMediaId] = useState(null)

  // Saran Balasan AI
  const [showAiMenu, setShowAiMenu] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiError, setAiError] = useState('')

  // Tags
  const [allTags, setAllTags] = useState([])
  const [showTagModal, setShowTagModal] = useState(false)
  const [tagToggling, setTagToggling] = useState(null)

  // Menu aksi pesan (long-press mobile)
  const [actionMsg, setActionMsg] = useState(null)
  const [deletingMsg, setDeletingMsg] = useState(false)

  // Forward pesan
  const [forwardMsg, setForwardMsg] = useState(null)
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwardList, setForwardList] = useState([])
  const [forwardSearch, setForwardSearch] = useState('')
  const [forwardingId, setForwardingId] = useState(null)
  const [forwardDone, setForwardDone] = useState(null)

  // Edit kontak (dari panel detail)
  const [showEditContact, setShowEditContact] = useState(false)
  const [editName, setEditName] = useState('')
  const [editWa, setEditWa] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [editContactError, setEditContactError] = useState('')

  // Contact notes panel
  const [showNotesPanel, setShowNotesPanel] = useState(false)
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [convHistory, setConvHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [aiNoteLoading, setAiNoteLoading] = useState(false)
  const [aiTagLoading, setAiTagLoading] = useState(false)
  const [aiTagSuggested, setAiTagSuggested] = useState([]) // tag_ids yang disarankan AI
  const [aiTagReason, setAiTagReason] = useState('')

  // Reminder
  const [showReminderMenu, setShowReminderMenu] = useState(false)
  const [reminderAt, setReminderAt] = useState('')
  const [reminderNote, setReminderNote] = useState('')
  const [savingReminder, setSavingReminder] = useState(false)
  const [reminderError, setReminderError] = useState('')

  const bottomRef = useRef(null)
  const messagesRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const { newMessages, statusUpdates, messageUpdates, assignmentUpdates, deletedMessages } = useSocket()
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [msgs, conv] = await Promise.all([getMessages(id), getConversation(id)])
      setMessages(Array.isArray(msgs) ? msgs : [])
      setConversation(conv || null)
      setError('')
    } catch { setError('Gagal memuat pesan.') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    fetchData()
    if (isAdmin) getAgents().then(d => setAgents(Array.isArray(d) ? d.filter(a => a.role === 'agent') : [])).catch(() => {})
    getTemplates().then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {})
    getQuickMedia().then(d => setQuickMedia(Array.isArray(d) ? d : [])).catch(() => {})
    getTags().then(d => setAllTags(Array.isArray(d) ? d : [])).catch(() => {})
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
    const relevant = messageUpdates.filter(m => String(m.conversationId) === String(id))
    if (!relevant.length) return
    setMessages(prev => {
      let next = prev
      for (const { message } of relevant) next = mergeMessage(next, message)
      return next
    })
  }, [messageUpdates, id])

  // Pesan dihapus dari sisi lain / perangkat lain -> hilangkan dari daftar
  useEffect(() => {
    const relevant = deletedMessages.filter(m => String(m.conversationId) === String(id))
    if (!relevant.length) return
    const ids = new Set(relevant.map(m => String(m.id)))
    setMessages(prev => prev.filter(m => !ids.has(String(m.id))))
  }, [deletedMessages, id])

  // Auto-assign realtime: update badge agent di header chat yang sedang dibuka
  useEffect(() => {
    const relevant = assignmentUpdates.filter(a => String(a.conversationId) === String(id))
    if (!relevant.length) return
    const last = relevant[relevant.length - 1]
    setConversation(prev => {
      if (!prev) return prev
      if (last.agent) return { ...prev, agents: last.agent, status: 'in_progress' }
      return { ...prev, agents: null, status: prev.status === 'in_progress' ? 'open' : prev.status }
    })
  }, [assignmentUpdates, id])

  const scrolledForRef = useRef(null)

  useEffect(() => {
    const isFirstScrollForConv = scrolledForRef.current !== id
    scrolledForRef.current = id
    bottomRef.current?.scrollIntoView({ behavior: isFirstScrollForConv ? 'auto' : 'smooth' })
  }, [messages, id])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distanceFromBottom > 200)
    }
    handleScroll()
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [id])

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  const closeMenus = () => { setShowAgentMenu(false); setShowTemplateMenu(false); setShowMediaGallery(false); setShowReminderMenu(false); setShowMoreMenu(false); setShowAiMenu(false) }

  const handleRequestAiSuggestion = async () => {
    setShowAiMenu(true)
    setShowTemplateMenu(false)
    setShowMediaGallery(false)
    setAiLoading(true)
    setAiError('')
    setAiSuggestion('')
    try {
      const { suggestion } = await generateAiSuggestion(id)
      setAiSuggestion(suggestion || '')
    } catch (e) {
      if (e?.response?.status === 429) {
        setAiError(e?.response?.data?.error || 'Kuota AI sedang penuh. Tunggu sebentar lalu coba lagi.')
      } else {
        setAiError(e?.response?.data?.error || 'Gagal membuat saran, coba lagi')
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleUseAiSuggestion = () => {
    setText(aiSuggestion)
    setShowAiMenu(false)
    textareaRef.current?.focus()
  }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const msg = text.trim()
    const currentReply = replyTo
    setText('')
    setReplyTo(null)
    setSending(true)
    const tempId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, body: msg, from_me: true,
      timestamp: new Date().toISOString(), status: 'sending',
      reply_to_body: currentReply?.body || null,
      reply_to_from_me: currentReply?.from_me ?? null,
      reply_to_wa_id: currentReply?.wa_message_id || null,
    }])
    // Agent membalas -> chat jadi "Aktif" (optimistic, biar badge langsung berubah)
    setConversation(prev => prev && prev.status !== 'in_progress' ? { ...prev, status: 'in_progress' } : prev)
    try { await sendMessage(id, msg, currentReply) }
    catch (e) {
      setError(e?.response?.data?.error || 'Gagal mengirim.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(msg)
      setReplyTo(currentReply)
    } finally { setSending(false) }
  }

  // Pilih pesan untuk dibalas (quote)
  const handleReplyTo = (m) => {
    setReplyTo({
      wa_message_id: m.wa_message_id || null,
      body: m.body || (m.media_type ? `[${m.media_type}]` : ''),
      from_me: !!isFromMe(m),
    })
    textareaRef.current?.focus()
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
    const currentReply = replyTo
    setSelectedFile(null)
    setReplyTo(null)
    try { await sendMedia(id, f.file, text.trim() || undefined, currentReply); setText(''); await fetchData() }
    catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim file.'); setSelectedFile(f); setReplyTo(currentReply) }
    finally { setSending(false) }
  }

  const isMobileDevice = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

  const handleKeyDown = (e) => {
    if (isMobileDevice) return
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectedFile ? handleSendMedia() : handleSend() }
  }

  const contactName = conversation?.contact?.name || ''

  const insertTemplate = (tpl) => {
    const filled = (tpl.body || '').replaceAll('{{nama}}', contactName || 'Kak')
    setText(filled)
    setShowTemplateMenu(false)
    textareaRef.current?.focus()
    if (tpl.id) useTemplate(tpl.id).catch(() => {})
  }

  const handleTextChange = (e) => {
    const val = e.target.value
    setText(val)
    if (val.startsWith('/') && val.length > 0) setShowTemplateMenu(true)
    else if (showTemplateMenu) setShowTemplateMenu(false)
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  const slashQuery = text.startsWith('/') ? text.slice(1).toLowerCase() : ''
  const filteredTemplates = slashQuery
    ? templates.filter(t =>
        (t.shortcut || '').toLowerCase().includes(slashQuery) ||
        (t.title || '').toLowerCase().includes(slashQuery))
    : templates

  const handleSendQuickMedia = async (item) => {
    if (sendingQuickMediaId) return
    setSendingQuickMediaId(item.id)
    setShowMediaGallery(false)
    const currentReply = replyTo
    setReplyTo(null)
    try { await sendQuickMedia(id, item.id, undefined, currentReply); await fetchData() }
    catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim media.'); setReplyTo(currentReply) }
    finally { setSendingQuickMediaId(null) }
  }

  const handleAgentAssign = async (agent) => {
    closeMenus()
    try { await assignAgent(id, agent.id); setConversation(p => p ? { ...p, agents: agent, status: 'in_progress' } : p) }
    catch { setError('Gagal assign agent.') }
  }

  const handleUnassign = async () => {
    closeMenus()
    try { await unassignAgent(id); setConversation(p => p ? { ...p, agents: null, status: p.status === 'in_progress' ? 'open' : p.status } : p) }
    catch { setError('Gagal menghapus assign.') }
  }

  const handleCopyMessage = async (msg) => {
    setActionMsg(null)
    const text = msg?.body || msg?.content || msg?.text || ''
    if (!text) return
    try { await navigator.clipboard.writeText(text) }
    catch { setError('Gagal menyalin pesan.') }
  }

  const handleDeleteMessage = async (msg) => {
    setActionMsg(null)
    if (!msg?.id || String(msg.id).startsWith('tmp-')) return
    if (!window.confirm('Hapus pesan ini?')) return
    setDeletingMsg(true)
    try {
      await deleteMessage(msg.id)
      setMessages(prev => prev.filter(m => String(m.id) !== String(msg.id)))
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal menghapus pesan.')
    } finally { setDeletingMsg(false) }
  }

  const openForward = async (msg) => {
    setForwardMsg(msg)
    setForwardSearch('')
    setForwardDone(null)
    setForwardList([])
    setForwardLoading(true)
    try {
      const list = await getConversations(isAdmin ? undefined : user?.id)
      setForwardList(Array.isArray(list) ? list.filter(c => String(c.id) !== String(id)) : [])
    } catch { setForwardList([]) }
    finally { setForwardLoading(false) }
  }

  const handleForwardTo = async (targetId) => {
    if (!forwardMsg || forwardingId) return
    setForwardingId(targetId)
    try {
      await forwardMessage(forwardMsg.id, targetId)
      setForwardDone(targetId)
      setTimeout(() => { setForwardMsg(null); setForwardDone(null) }, 900)
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal meneruskan pesan.')
    } finally { setForwardingId(null) }
  }

  const openEditContact = () => {
    const c = conversation?.contact
    setEditName(c?.name || '')
    setEditWa(c?.manual_wa_number || '')
    setEditContactError('')
    setShowEditContact(true)
  }

  const handleSaveContact = async () => {
    const contactId = conversation?.contact?.id
    if (!contactId) { setEditContactError('Kontak tidak ditemukan.'); return }
    setSavingContact(true); setEditContactError('')
    try {
      const updated = await updateContact(contactId, {
        name: editName.trim(),
        manual_wa_number: editWa.trim(),
      })
      setConversation(p => p ? { ...p, contact: { ...p.contact, ...updated } } : p)
      setShowEditContact(false)
    } catch (e) {
      setEditContactError(e?.response?.data?.error || 'Gagal menyimpan kontak.')
    } finally { setSavingContact(false) }
  }

  const conversationTags = conversation?.tags || []

  const handleToggleTag = async (tag) => {
    if (tagToggling) return
    setTagToggling(tag.id)
    const hasTag = conversationTags.some(t => t.id === tag.id)
    try {
      if (hasTag) await removeTagFromConversation(id, tag.id)
      else await addTagToConversation(id, tag.id)
      await fetchData()
      window.dispatchEvent(new CustomEvent('cv:conversation-updated', { detail: { id } }))
    } catch { setError('Gagal mengubah tag percakapan.') }
    finally { setTagToggling(null) }
  }

  const loadNotes = useCallback(async () => {
    if (!conversation?.contact?.id) return
    setLoadingNotes(true)
    try { setNotes(await getContactNotes(conversation.contact.id)) } catch {}
    finally { setLoadingNotes(false) }
  }, [conversation])

  const loadHistory = useCallback(async () => {
    if (!conversation?.contact?.id) return
    setLoadingHistory(true)
    try {
      const data = await getContactConversations(conversation.contact.id)
      setConvHistory(Array.isArray(data) ? data.filter(c => String(c.id) !== String(id)) : [])
    } catch {}
    finally { setLoadingHistory(false) }
  }, [conversation, id])

  const handleToggleNotesPanel = () => {
    const next = !showNotesPanel
    setShowNotesPanel(next)
    if (next) { loadNotes(); loadHistory() }
  }

  const handleOpenHistoryConversation = (convId) => {
    navigate(`/chat/${convId}`)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim() || savingNote || !conversation?.contact?.id) return
    setSavingNote(true)
    try {
      const payload = { body: noteText.trim() }
      if (user?.id) payload.agent_id = user.id
      const note = await createContactNote(conversation.contact.id, payload)
      setNotes(prev => [note, ...prev])
      setNoteText('')
    } catch { setError('Gagal menyimpan catatan.') }
    finally { setSavingNote(false) }
  }

  const handleAiSuggestNote = async () => {
    if (aiNoteLoading) return
    setAiNoteLoading(true)
    try {
      const { note } = await suggestAiNote(id)
      if (note) setNoteText(note)
    } catch (e) {
      setError(e?.response?.status === 429 ? 'Kuota AI sedang penuh, coba lagi.' : 'Gagal membuat catatan AI.')
    } finally { setAiNoteLoading(false) }
  }

  const handleAiSuggestTags = async () => {
    if (aiTagLoading) return
    setAiTagLoading(true); setAiTagReason('')
    try {
      const { tag_ids, reason } = await suggestAiTags(id)
      setAiTagSuggested(Array.isArray(tag_ids) ? tag_ids : [])
      setAiTagReason(reason || '')
    } catch (e) {
      setError(e?.response?.status === 429 ? 'Kuota AI sedang penuh, coba lagi.' : 'Gagal membuat saran tag AI.')
    } finally { setAiTagLoading(false) }
  }

  const handleSaveReminder = async () => {
    if (!reminderAt || savingReminder) return
    setSavingReminder(true); setReminderError('')
    try {
      const payload = { conversation_id: id, remind_at: new Date(reminderAt).toISOString() }
      if (user?.id) payload.agent_id = user.id
      if (reminderNote.trim()) payload.note = reminderNote.trim()
      await createReminder(payload)
      setReminderAt(''); setReminderNote('')
      setShowReminderMenu(false)
    } catch (e) { setReminderError(e?.response?.data?.error || 'Gagal menyimpan pengingat.') }
    finally { setSavingReminder(false) }
  }

  const name = conversation?.contact?.name || conversation?.contact?.phone || 'Unknown'
  const phone = conversation?.contact?.manual_wa_number || cleanPhone(conversation?.contact?.phone)
  const assignedAgent = conversation?.agents

  const messageItems = []
  let lastDateKey = null
  // Urutkan kronologis (pesan hasil sinkronisasi bisa masuk tidak berurutan)
  const orderedMessages = [...messages].sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime()
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime()
    return ta - tb
  })
  for (const msg of orderedMessages) {
    const ts = msg.timestamp || msg.createdAt
    const dk = getDateKey(ts)
    if (dk && dk !== lastDateKey) { messageItems.push({ type: 'date', key: dk, label: formatDateLabel(ts) }); lastDateKey = dk }
    messageItems.push({ type: 'msg', msg })
  }

  return (
    <div className={`cv-root${showNotesPanel ? ' with-sidebar' : ''}`} onClick={closeMenus}>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      <div className="cv-chat-col">

      <div className="cv-header" onClick={e => e.stopPropagation()}>
        <button className="cv-back" onClick={() => navigate('/inbox')}><ArrowLeft size={20} /></button>
        <div className="cv-avatar" style={avatarStyle(name)}>{name[0].toUpperCase()}</div>
        <div className="cv-contact" onClick={handleToggleNotesPanel} role="button" tabIndex={0}>
          <div className="cv-name">{name}</div>
          <div className="cv-sub">
            {conversation?.status && (
              <span className={`cv-status-badge st-${conversation.status}`}>{statusLabel(conversation.status)}</span>
            )}
            {isAdmin && assignedAgent && <span className="cv-assigned"><UserCheck size={10} />{assignedAgent.name}</span>}
            {isAdmin && !assignedAgent && <span className="cv-unassigned">Unassigned</span>}
            {conversationTags.map(t => (
              <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
            ))}
            <button className="cv-tag-edit-btn" title="Atur tag" onClick={e => { e.stopPropagation(); setShowTagModal(true) }}>
              <TagIcon size={12} />
            </button>
          </div>
        </div>
        <div className="cv-actions" onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <div className="cv-dd">
              <button className="cv-assign-btn" onClick={() => { setShowAgentMenu(!showAgentMenu); setShowReminderMenu(false) }}>
                <UserCheck size={15} /><span className="cv-btn-label">Assign</span>
              </button>
              {showAgentMenu && (
                <div className="cv-menu cv-header-menu" style={{minWidth:200}}>
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
                  {assignedAgent && (
                    <button className="cv-mi cv-mi-unassign" onClick={handleUnassign}>
                      <span><X size={13} style={{verticalAlign:-2,marginRight:5}} />Hapus assign</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button className={`cv-del-conv-btn${showNotesPanel ? ' active' : ''}`} title="Catatan kontak" onClick={handleToggleNotesPanel}>
            <StickyNote size={15} />
          </button>
          <div className="cv-dd cv-reminder-dd">
            <button className="cv-del-conv-btn" title="Ingatkan follow-up" onClick={() => { setShowReminderMenu(!showReminderMenu); setShowAgentMenu(false) }}>
              <BellPlus size={15} />
            </button>
            {showReminderMenu && (
              <div className="cv-menu cv-header-menu cv-reminder-menu" style={{ width: 'min(240px, calc(100vw - 32px))' }}>
                <div className="cv-menu-lbl">Ingatkan Follow-up</div>
                <div className="cv-reminder-form">
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={e => setReminderAt(e.target.value)}
                    className="cv-reminder-input"
                  />
                  <input
                    type="text"
                    placeholder="Catatan singkat (opsional)"
                    value={reminderNote}
                    onChange={e => setReminderNote(e.target.value)}
                    className="cv-reminder-input"
                  />
                  {reminderError && <div className="cv-reminder-err">{reminderError}</div>}
                  <button className="cv-reminder-save" onClick={handleSaveReminder} disabled={!reminderAt || savingReminder}>
                    {savingReminder ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTagModal && (
        <Modal title="Atur Tag Percakapan" onClose={() => { setShowTagModal(false); setAiTagSuggested([]); setAiTagReason('') }}>
          <div className="cv-tag-modal-list">
            {allTags.length > 0 && (
              <button className="cv-ai-tag-btn" onClick={handleAiSuggestTags} disabled={aiTagLoading}>
                <Sparkles size={14} />{aiTagLoading ? 'Menganalisa...' : 'Saran Tag AI'}
              </button>
            )}
            {aiTagReason && <div className="cv-ai-tag-reason">{aiTagReason}</div>}
            {allTags.length === 0 ? (
              <div className="cv-mi muted">Belum ada tag. Buat di halaman Template & Galeri.</div>
            ) : allTags.map(t => {
              const checked = conversationTags.some(ct => ct.id === t.id)
              const suggested = aiTagSuggested.includes(t.id) && !checked
              return (
                <button
                  key={t.id}
                  className={`cv-tag-option${checked ? ' checked' : ''}${suggested ? ' suggested' : ''}`}
                  disabled={!!tagToggling}
                  onClick={() => handleToggleTag(t)}
                >
                  <span className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                  {suggested && <span className="cv-ai-tag-badge"><Sparkles size={11} />disarankan</span>}
                  {tagToggling === t.id
                    ? <div className="cv-sending-dot dark" />
                    : checked && <Check size={14} />}
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {actionMsg && (
        <div className="cv-sheet-overlay" onClick={() => setActionMsg(null)}>
          <div className="cv-sheet" onClick={e => e.stopPropagation()}>
            <div className="cv-sheet-preview">{actionMsg.body || (actionMsg.media_type ? `[${actionMsg.media_type}]` : 'Pesan')}</div>
            <button className="cv-sheet-item" onClick={() => { const m = actionMsg; setActionMsg(null); handleReplyTo(m) }}>
              <Reply size={18} /> Balas
            </button>
            {(actionMsg.body && !actionMsg.body.startsWith('[')) && (
              <button className="cv-sheet-item" onClick={() => handleCopyMessage(actionMsg)}>
                <Copy size={18} /> Salin
              </button>
            )}
            <button className="cv-sheet-item" onClick={() => { const m = actionMsg; setActionMsg(null); openForward(m) }}>
              <Forward size={18} /> Teruskan
            </button>
            <button className="cv-sheet-item danger" onClick={() => handleDeleteMessage(actionMsg)}>
              <Trash2 size={18} /> Hapus
            </button>
            <button className="cv-sheet-cancel" onClick={() => setActionMsg(null)}>Batal</button>
          </div>
        </div>
      )}

      {forwardMsg && (
        <Modal title="Teruskan pesan ke" onClose={() => setForwardMsg(null)}>
          <div className="cv-forward">
            <div className="cv-forward-preview">
              {forwardMsg.media_type ? <span className="cv-forward-media"><Paperclip size={12} /> {forwardMsg.media_type}</span> : null}
              <span className="cv-forward-preview-text">{forwardMsg.body || (forwardMsg.media_type ? '[media]' : 'Pesan')}</span>
            </div>
            <div className="cv-forward-search">
              <SearchIcon size={14} />
              <input value={forwardSearch} onChange={e => setForwardSearch(e.target.value)} placeholder="Cari kontak/percakapan..." autoFocus />
            </div>
            <div className="cv-forward-list">
              {forwardLoading ? (
                <div className="cv-forward-loading">
                  <div className="cv-forward-spinner" />
                  <span>Memuat daftar chat…</span>
                </div>
              ) : forwardList.length === 0 ? (
                <div className="cv-forward-empty">Tidak ada percakapan lain.</div>
              ) : (
                forwardList
                  .filter(c => {
                    const q = forwardSearch.toLowerCase()
                    if (!q) return true
                    return (c.contact?.name || '').toLowerCase().includes(q) || (c.contact?.phone || '').includes(q)
                  })
                  .slice(0, 50)
                  .map(c => {
                    const cname = c.contact?.name || c.contact?.phone || 'Unknown'
                    return (
                      <button key={c.id} className="cv-forward-item" disabled={!!forwardingId} onClick={() => handleForwardTo(c.id)}>
                        <span className="cv-forward-avatar">{cname[0].toUpperCase()}</span>
                        <span className="cv-forward-name">{cname}</span>
                        {forwardDone === c.id
                          ? <Check size={16} className="cv-forward-check" />
                          : forwardingId === c.id
                            ? <div className="cv-sending-dot dark" />
                            : <Forward size={14} className="cv-forward-ico" />}
                      </button>
                    )
                  })
              )}
            </div>
          </div>
        </Modal>
      )}

      {showEditContact && (
        <Modal title="Edit Kontak" onClose={() => setShowEditContact(false)}>
          <div className="cv-edit-contact">
            <label className="cv-edit-label">Nama Kontak</label>
            <input
              className="cv-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Nama kontak"
              autoFocus
            />
            <label className="cv-edit-label">Nomor WA Manual</label>
            <input
              className="cv-edit-input"
              value={editWa}
              onChange={e => setEditWa(e.target.value)}
              placeholder="contoh: 6281234567890"
            />
            <p className="cv-edit-hint">Nomor WA manual dipakai bila nomor terdeteksi berbeda dari nomor asli kontak.</p>
            {editContactError && <div className="cv-edit-error">{editContactError}</div>}
            <div className="cv-edit-actions">
              <button className="cv-edit-cancel" onClick={() => setShowEditContact(false)} disabled={savingContact}>Batal</button>
              <button className="cv-edit-save" onClick={handleSaveContact} disabled={savingContact || !editName.trim()}>
                {savingContact ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {error && (
        <div className="cv-error">
          {error}<button onClick={() => setError('')} style={{marginLeft:8,fontWeight:700}}>×</button>
        </div>
      )}

      <div className="cv-messages-wrap">
      <div className="cv-messages" ref={messagesRef}>
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
            const isSending = String(msg.id).startsWith('tmp-')
            return (
              <SwipeMessageRow
                key={msg.id || i}
                msg={msg}
                sent={sent}
                isSending={isSending}
                hasMedia={!!msg.media_type}
                hasReply={!!(msg.reply_to_body || msg.reply_to_wa_id)}
                name={name}
                onReply={() => handleReplyTo(msg)}
                onForward={() => openForward(msg)}
                onDelete={() => handleDeleteMessage(msg)}
                onMenu={() => setActionMsg(msg)}
                onImageClick={setLightboxUrl}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
        {showScrollBtn && (
          <button className="cv-scroll-bottom-btn" title="Scroll ke pesan terbaru" onClick={scrollToBottom}>
            <ArrowDown size={18} />
          </button>
        )}
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

      {replyTo && (
        <div className="cv-reply-preview" onClick={e => e.stopPropagation()}>
          <div className="cv-reply-preview-bar" />
          <div className="cv-reply-preview-content">
            <span className="cv-reply-preview-who">{replyTo.from_me ? 'Anda' : name}</span>
            <span className="cv-reply-preview-text">{replyTo.body || 'Pesan'}</span>
          </div>
          <button className="cv-reply-preview-x" onClick={() => setReplyTo(null)}><X size={16} /></button>
        </div>
      )}

      <div className="cv-input-bar" onClick={e => e.stopPropagation()}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
          onChange={handleFileSelect} />

        <div className="cv-dd cv-more-dd">
          <button className="cv-attach-btn" title="Lainnya" onClick={() => setShowMoreMenu(!showMoreMenu)}>
            <MoreVertical size={19} />
          </button>
          {showMoreMenu && (
            <div className="cv-menu cv-more-menu">
              <button className="cv-mi" onClick={() => { setShowMoreMenu(false); fileInputRef.current?.click() }}>
                <span className="cv-mi-title"><Paperclip size={14} /><span className="cv-mi-title-text">Lampirkan file</span></span>
              </button>
              <button className="cv-mi" onClick={() => { setShowMoreMenu(false); setShowTemplateMenu(true) }}>
                <span className="cv-mi-title"><Zap size={14} /><span className="cv-mi-title-text">Template Pesan</span></span>
              </button>
              <button className="cv-mi" onClick={() => { setShowMoreMenu(false); setShowMediaGallery(true) }}>
                <span className="cv-mi-title"><Package size={14} /><span className="cv-mi-title-text">Produk / Katalog</span></span>
              </button>
              <button className="cv-mi" onClick={() => { setShowMoreMenu(false); handleRequestAiSuggestion() }}>
                <span className="cv-mi-title"><Sparkles size={14} /><span className="cv-mi-title-text">Saran AI</span></span>
              </button>
            </div>
          )}
        </div>

        <div className="cv-attach-group">
        <button className="cv-attach-btn" onClick={() => fileInputRef.current?.click()} title="Lampirkan file">
          <Paperclip size={19} />
        </button>

        <button className="cv-attach-btn" title="Template Pesan" onClick={() => { setShowTemplateMenu(!showTemplateMenu); setShowMediaGallery(false) }}>
          <Zap size={19} />
        </button>

        <button className="cv-attach-btn" title="Produk/Katalog" onClick={() => { setShowMediaGallery(!showMediaGallery); setShowTemplateMenu(false) }}>
          <Package size={19} />
        </button>

        <button className="cv-attach-btn" title="Saran Balasan AI" onClick={() => { showAiMenu ? setShowAiMenu(false) : handleRequestAiSuggestion() }}>
          <Sparkles size={19} />
        </button>
        </div>

        <div className="cv-dd cv-shared-menu-anchor">
          {showTemplateMenu && (
            <div className="cv-menu cv-template-menu" style={{minWidth:260}}>
              <div className="cv-menu-lbl">Template Pesan{slashQuery && <span> &middot; filter: "{slashQuery}"</span>}</div>
              {filteredTemplates.length === 0 ? (
                <div className="cv-mi muted">Tidak ada template cocok</div>
              ) : filteredTemplates.map(t => (
                <button key={t.id} className="cv-mi" onClick={() => insertTemplate(t)}>
                  <span className="cv-mi-title">
                    <span className="cv-mi-title-text">{t.title}</span>
                    {t.shortcut && <span className="cv-mi-sub">/{t.shortcut}</span>}
                  </span>
                  <span className="cv-mi-sub cv-tpl-preview">{t.body}</span>
                </button>
              ))}
            </div>
          )}
          {showMediaGallery && (
            <div className="cv-menu cv-media-menu" style={{minWidth:260}}>
              <div className="cv-menu-lbl">Produk / Katalog</div>
              {quickMedia.length === 0 ? (
                <div className="cv-mi muted">Belum ada media di galeri</div>
              ) : (
                <div className="cv-media-grid">
                  {quickMedia.map(m => (
                    <button
                      key={m.id}
                      className="cv-media-grid-item"
                      disabled={!!sendingQuickMediaId}
                      onClick={() => handleSendQuickMedia(m)}
                      title={m.label}
                    >
                      {m.media_type === 'image'
                        ? <img src={m.media_url} alt={m.label} />
                        : <div className="cv-media-grid-doc"><FileText size={22} /></div>}
                      <span className="cv-media-grid-label">{m.label}</span>
                      {sendingQuickMediaId === m.id && <div className="cv-media-grid-sending"><div className="cv-sending-dot dark" /></div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showAiMenu && (
            <div className="cv-menu cv-ai-menu" style={{minWidth:260}}>
              <div className="cv-menu-lbl">Saran Balasan AI</div>
              {aiLoading ? (
                <div className="cv-mi muted cv-ai-loading"><div className="cv-sending-dot dark" /> Membuat saran...</div>
              ) : aiError ? (
                <div className="cv-ai-error-box">
                  <span>{aiError}</span>
                  <button className="cv-ai-retry" onClick={handleRequestAiSuggestion}>Coba lagi</button>
                </div>
              ) : (
                <div className="cv-ai-suggestion-box">
                  <p className="cv-ai-suggestion-text">{aiSuggestion}</p>
                  <div className="cv-ai-suggestion-actions">
                    <button className="cv-ai-use-btn" onClick={handleUseAiSuggestion}>Gunakan</button>
                    <button className="cv-ai-close-btn" onClick={() => setShowAiMenu(false)}>Tutup</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="cv-input"
          placeholder={selectedFile ? 'Tambah keterangan (opsional)...' : 'Ketik pesan...'}
          value={text}
          onChange={handleTextChange}
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

      </div>

      {showNotesPanel && (
        <div className="cv-notes-sidebar" onClick={e => e.stopPropagation()}>
          <div className="cv-notes-sidebar-header">
            <span>Catatan & Riwayat</span>
            <button className="cv-notes-sidebar-close" onClick={handleToggleNotesPanel}><X size={16} /></button>
          </div>
          <div className="cv-notes-contact">
            <div className="cv-notes-contact-name-row">
              <div className="cv-notes-contact-name">{name}</div>
              {isAdmin && (
                <button className="cv-contact-edit-btn" title="Edit kontak" onClick={openEditContact}>
                  <Pencil size={13} />
                </button>
              )}
            </div>
            {phone && <div className="cv-notes-contact-phone">{phone}</div>}
            <div className="cv-notes-contact-row">
              <span className="cv-notes-contact-label">Agent</span>
              {assignedAgent
                ? <span className="cv-assigned"><UserCheck size={10} />{assignedAgent.name}</span>
                : <span className="cv-unassigned">Unassigned</span>}
            </div>
            <div className="cv-notes-contact-row">
              <span className="cv-notes-contact-label">Label</span>
              <div className="cv-notes-contact-tags">
                {conversationTags.length === 0
                  ? <span className="cv-notes-empty-inline">Belum ada label</span>
                  : conversationTags.map(t => (
                    <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                  ))}
                <button className="cv-tag-edit-btn" title="Atur tag" onClick={() => setShowTagModal(true)}>
                  <TagIcon size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="cv-notes-list">
            {loadingNotes ? (
              <div className="cv-notes-loading">Memuat catatan...</div>
            ) : notes.length === 0 ? (
              <div className="cv-notes-empty">Belum ada catatan.</div>
            ) : (
              notes.map(n => (
                <div key={n.id} className="cv-note-item">
                  <p className="cv-note-body">{n.body}</p>
                  <div className="cv-note-meta">
                    <span>{n.agents?.name || 'Sistem'}</span>
                    <span>{formatReminderTime(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="cv-notes-form">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Tulis catatan tentang kontak ini..."
              rows={2}
            />
            <div className="cv-notes-form-actions">
              <button className="cv-note-ai" onClick={handleAiSuggestNote} disabled={aiNoteLoading}>
                <Sparkles size={13} />{aiNoteLoading ? 'Membuat...' : 'Buat dari AI'}
              </button>
              <button className="cv-note-save" onClick={handleSaveNote} disabled={!noteText.trim() || savingNote}>
                {savingNote ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>

          <div className="cv-history-section">
            <div className="cv-history-title">Riwayat Percakapan</div>
            {loadingHistory ? (
              <div className="cv-notes-loading">Memuat riwayat...</div>
            ) : convHistory.length === 0 ? (
              <div className="cv-notes-empty">Tidak ada percakapan lain dengan kontak ini.</div>
            ) : (
              <div className="cv-history-list">
                {convHistory.map(h => (
                  <button key={h.id} className="cv-history-item" onClick={() => handleOpenHistoryConversation(h.id)}>
                    <div className="cv-history-item-top">
                      <span className={`cv-history-badge st-${h.status || 'open'}`}>{statusLabel(h.status)}</span>
                      <span className="cv-history-time">{formatReminderTime(h.lastMessageAt || h.updated_at)}</span>
                    </div>
                    <div className="cv-history-preview">{h.lastMessage || 'Belum ada pesan'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .cv-root { flex: 1; display: flex; flex-direction: row; min-height: 0; min-width: 0; background: #f0f3fa; overflow: hidden; }
        .cv-chat-col { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
        .cv-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e4eaf5; flex-shrink: 0; min-height: 64px; }
        .cv-back { display: none; width: 36px; height: 36px; border-radius: 8px; align-items: center; justify-content: center; color: #8a9bb8; flex-shrink: 0; }
        .cv-back:hover { background: #f0f3fa; }
        @media (max-width: 768px) { .cv-back { display: flex; } }
        .cv-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex-shrink: 0; }
        .cv-contact { flex: 1; min-width: 0; overflow: hidden; cursor: pointer; border-radius: 8px; padding: 2px 6px; margin: -2px -6px; transition: background 0.15s; }
        .cv-contact:hover { background: #f0f3fa; }
        .cv-name { font-size: 14px; font-weight: 600; color: #1a2540; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 1px; }
        .cv-assigned { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: rgba(39,168,122,0.1); color: #27a87a; }
        .cv-unassigned { font-size: 11px; padding: 1px 7px; border-radius: 10px; background: rgba(208,139,40,0.1); color: #d08b28; }
        .cv-status-badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px; }
        .cv-status-badge.st-open { background: rgba(208,139,40,0.12); color: #d08b28; }
        .cv-status-badge.st-in_progress { background: rgba(53,99,233,0.12); color: #3563e9; }
        .cv-status-badge.st-resolved { background: rgba(39,168,122,0.12); color: #27a87a; }
        .cv-actions { position: relative; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-header-menu { position: fixed !important; top: 66px !important; right: 16px !important; left: auto !important; }
        .cv-assign-btn { display: flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #4f607a; background: #f0f3fa; border: 1px solid #e4eaf5; transition: all 0.15s; }
        .cv-assign-btn:hover { background: #e8eef8; }
        .cv-del-conv-btn { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; }
        .cv-del-conv-btn:hover { background: rgba(229,62,62,0.08); color: #e53e3e; }
        .cv-menu { position: absolute; right: 0; top: calc(100% + 6px); max-width: calc(100vw - 24px); box-sizing: border-box; background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; z-index: 200; box-shadow: 0 8px 24px rgba(26,37,64,0.10); overflow: hidden; }
        .cv-reminder-menu { box-sizing: border-box; }
        .cv-menu-lbl { padding: 8px 14px 4px; font-size: 10px; font-weight: 700; color: #a8b8d0; text-transform: uppercase; letter-spacing: 0.5px; }
        .cv-mi { display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left; padding: 9px 14px; font-size: 13px; color: #1a2540; transition: background 0.1s; }
        .cv-mi:hover { background: #f7f9fd; }
        .cv-mi.muted { color: #a8b8d0; cursor: default; }
        .cv-mi-unassign { color: #e53e3e; border-top: 1px solid #f0f3fa; }
        .cv-mi-unassign:hover { background: rgba(229,62,62,0.06); }
        .cv-mi.active { background: rgba(39,168,122,0.06); color: #27a87a; }
        .cv-mi-title { display: flex; align-items: baseline; justify-content: flex-start; gap: 6px; width: 100%; text-align: left; }
        .cv-mi-title-text { text-align: left; }
        .cv-mi-sub { font-size: 11px; color: #a8b8d0; margin-top: 1px; text-align: left; }
        .cv-error { background: rgba(229,62,62,0.05); border-bottom: 1px solid rgba(229,62,62,0.12); color: #c44; padding: 8px 16px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .cv-messages-wrap { position: relative; flex: 1; min-height: 0; display: flex; }
        .cv-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 2px; background: #f0f3fa; }
        .cv-scroll-bottom-btn { position: absolute; right: 20px; bottom: 16px; width: 38px; height: 38px; border-radius: 50%; background: #fff; color: #4f607a; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(26,37,64,0.18); border: 1px solid #e4eaf5; z-index: 50; transition: all 0.15s; animation: popIn 0.18s ease-out; }
        .cv-scroll-bottom-btn:hover { background: #f7f9fd; color: #3563e9; }
        .cv-loading { display: flex; flex-direction: column; gap: 8px; }
        .cv-skel { height: 40px; max-width: 55%; border-radius: 10px; background: rgba(0,0,0,0.05); animation: pulse 1.4s ease infinite; }
        .cv-skel.left { align-self: flex-start; }
        .cv-skel.right { align-self: flex-end; }
        .cv-empty { margin: auto; color: #a8b8d0; font-size: 14px; text-align: center; padding: 32px; }
        .cv-date-sep { display: flex; align-items: center; justify-content: center; margin: 12px 0 8px; }
        .cv-date-sep span { background: #dce8fb; color: #5a7ab5; font-size: 11px; font-weight: 600; padding: 4px 14px; border-radius: 20px; }
        .cv-row { display: flex; margin-bottom: 3px; align-items: center; gap: 6px; position: relative; touch-action: pan-y; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        /* Tombol aksi saat hover — hanya untuk perangkat desktop (punya hover & pointer presisi) */
        .cv-hover-actions { display: none; align-items: center; gap: 2px; opacity: 0; transition: opacity 0.12s; order: 0; }
        .cv-row.sent .cv-hover-actions { order: -1; }
        .cv-row.recv .cv-hover-actions { order: 2; }
        .cv-hover-btn { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8a9bb8; background: transparent; }
        .cv-hover-btn:hover { background: #e4eaf5; color: #3563e9; }
        .cv-hover-btn.danger:hover { background: #fde8e8; color: #e53e3e; }
        @media (hover: hover) and (pointer: fine) {
          .cv-hover-actions { display: flex; }
          .cv-row:hover .cv-hover-actions { opacity: 1; }
        }
        /* Perangkat sentuh: matikan seleksi teks & callout agar long-press = menu aksi */
        @media (pointer: coarse) {
          .cv-bubble { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        }
        /* Action sheet (long-press mobile) */
        .cv-sheet-overlay { position: fixed; inset: 0; z-index: 600; background: rgba(15,23,42,0.45); display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s ease; }
        .cv-sheet { width: 100%; max-width: 460px; background: #fff; border-radius: 16px 16px 0 0; padding: 8px; display: flex; flex-direction: column; gap: 2px; animation: sheetUp 0.2s ease-out; padding-bottom: max(8px, env(safe-area-inset-bottom)); }
        .cv-sheet-preview { font-size: 12px; color: #8a9bb8; padding: 10px 14px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid #f0f3fa; margin-bottom: 4px; }
        .cv-sheet-item { display: flex; align-items: center; gap: 14px; padding: 14px 16px; font-size: 15px; color: #1a2540; border-radius: 10px; text-align: left; }
        .cv-sheet-item:active { background: #f0f3fa; }
        .cv-sheet-item.danger { color: #e53e3e; }
        .cv-sheet-cancel { margin-top: 4px; padding: 13px; font-size: 15px; font-weight: 600; color: #4f607a; background: #f0f3fa; border-radius: 10px; }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        /* Forward modal */
        .cv-forward { display: flex; flex-direction: column; padding: 14px 16px 16px; gap: 10px; }
        .cv-forward-preview { background: #f0f3fa; border-left: 3px solid #3563e9; border-radius: 6px; padding: 7px 10px; font-size: 13px; color: #4f607a; display: flex; flex-direction: column; gap: 2px; }
        .cv-forward-media { font-size: 11px; font-weight: 700; color: #3563e9; display: inline-flex; align-items: center; gap: 4px; text-transform: capitalize; }
        .cv-forward-preview-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-forward-search { display: flex; align-items: center; gap: 8px; border: 1px solid #e4eaf5; border-radius: 8px; padding: 7px 10px; color: #8a9bb8; }
        .cv-forward-search input { flex: 1; border: none; outline: none; font-size: 14px; color: #1a2540; background: transparent; }
        .cv-forward-list { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
        .cv-forward-empty { text-align: center; color: #8a9bb8; font-size: 13px; padding: 20px 0; }
        .cv-forward-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #8a9bb8; font-size: 13px; padding: 28px 0; }
        .cv-forward-spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid #e4eaf5; border-top-color: #3563e9; animation: cvspin 0.7s linear infinite; }
        @keyframes cvspin { to { transform: rotate(360deg); } }
        .cv-forward-item { display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-radius: 8px; text-align: left; transition: background 0.12s; }
        .cv-forward-item:hover:not(:disabled) { background: #f0f3fa; }
        .cv-forward-item:disabled { opacity: 0.6; }
        .cv-forward-avatar { width: 32px; height: 32px; border-radius: 50%; background: #cdd8ee; color: #3563e9; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cv-forward-name { flex: 1; font-size: 14px; color: #1a2540; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-forward-ico { color: #a8b8d0; flex-shrink: 0; }
        .cv-forward-check { color: #10b981; flex-shrink: 0; }
        .cv-swipe-cue { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e4eaf5; color: #8a9bb8; transition: background 0.12s, color 0.12s; }
        .cv-swipe-cue.left { left: 4px; }
        .cv-swipe-cue.right { right: 4px; }
        .cv-swipe-cue.active { background: #3563e9; color: #fff; }
        .cv-quote { display: flex; flex-direction: column; gap: 1px; border-left: 3px solid; padding: 4px 8px; margin-bottom: 5px; border-radius: 5px; max-width: 100%; overflow: hidden; }
        .cv-quote.on-sent { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.14); }
        .cv-quote.on-recv { border-color: #3563e9; background: #f0f3fa; }
        .cv-quote-who { font-size: 11px; font-weight: 700; }
        .cv-quote.on-sent .cv-quote-who { color: rgba(255,255,255,0.95); }
        .cv-quote.on-recv .cv-quote-who { color: #3563e9; }
        .cv-quote-text { font-size: 12px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
        .cv-quote.on-sent .cv-quote-text { color: rgba(255,255,255,0.85); }
        .cv-quote.on-recv .cv-quote-text { color: #4f607a; }
        .cv-reply-preview { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #eef4fd; border-top: 1px solid #c8d4ec; }
        .cv-reply-preview-bar { width: 3px; align-self: stretch; background: #3563e9; border-radius: 2px; flex-shrink: 0; }
        .cv-reply-preview-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .cv-reply-preview-who { font-size: 12px; font-weight: 700; color: #3563e9; }
        .cv-reply-preview-text { font-size: 12px; color: #4f607a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-reply-preview-x { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #8a9bb8; flex-shrink: 0; }
        .cv-reply-preview-x:hover { background: #dce8fb; color: #3563e9; }
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
        .cv-input-bar { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; border-top: 1px solid #e4eaf5; flex-shrink: 0; }
        .cv-shared-menu-anchor { position: absolute; left: 14px; bottom: 100%; width: 0; height: 0; }
        .cv-attach-btn { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; border: 1.5px solid #e4eaf5; background: #f7f9fd; }
        .cv-attach-btn:hover { background: #eef4fd; color: #3563e9; border-color: #c8d4ec; }
        .cv-attach-group { display: contents; }
        .cv-more-dd { display: none; }
        .cv-more-menu { min-width: 200px; }
        .cv-more-menu .cv-mi-title { gap: 10px; }
        .cv-input { flex: 1; background: #f7f9fd; border: 1.5px solid #e4eaf5; border-radius: 12px; color: #1a2540; padding: 11px 14px; font-size: 14px; line-height: 22px; height: 44px; min-height: 44px; max-height: 120px; outline: none; resize: none; overflow-y: auto; transition: border-color 0.15s; font-family: inherit; }
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
        .cv-input-bar .cv-dd .cv-menu { bottom: calc(100% + 8px); top: auto; left: 0; right: auto; max-height: 360px; overflow-y: auto; }
        .cv-tpl-preview { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 230px; }
        .cv-media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px; }
        .cv-media-grid-item { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 8px; overflow: hidden; background: #f7f9fd; border: 1px solid #e4eaf5; padding: 0 0 4px; }
        .cv-media-grid-item:hover { border-color: #3563e9; }
        .cv-media-grid-item img { width: 100%; height: 64px; object-fit: cover; }
        .cv-media-grid-doc { width: 100%; height: 64px; display: flex; align-items: center; justify-content: center; color: #94a3b8; background: #eef4fd; }
        .cv-media-grid-label { font-size: 10px; color: #4f607a; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .cv-media-grid-sending { position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; }
        .cv-sending-dot.dark { border-color: rgba(53,99,233,0.3); border-top-color: #3563e9; }
        .cv-ai-loading { flex-direction: row; align-items: center; gap: 8px; color: #a8b8d0; }
        .cv-ai-suggestion-box { padding: 6px 14px 12px; display: flex; flex-direction: column; gap: 10px; }
        .cv-ai-suggestion-text { font-size: 13px; color: #1a2540; white-space: pre-wrap; line-height: 1.5; background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 8px; padding: 10px 12px; max-height: 180px; overflow-y: auto; }
        .cv-ai-suggestion-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .cv-ai-use-btn { padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; background: #3563e9; color: #fff; transition: all 0.15s; }
        .cv-ai-use-btn:hover { background: #2850cc; }
        .cv-ai-close-btn { padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500; color: #4f607a; background: #f0f3fa; }
        .cv-ai-close-btn:hover { background: #e8eef8; }
        .cv-ai-error-box { display: flex; flex-direction: column; gap: 8px; padding: 6px 14px 14px; font-size: 13px; color: #c44; }
        .cv-ai-retry { align-self: flex-start; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; background: rgba(229,62,62,0.08); color: #e53e3e; }
        .cv-ai-retry:hover { background: rgba(229,62,62,0.14); }
        @media (max-width: 768px) {
          .cv-header { padding: 10px 12px; gap: 8px; min-height: 56px; }
          .cv-messages { padding: 12px; }
          .cv-bubble { max-width: 78%; }
          .cv-btn-label { display: none; }
          .cv-actions { gap: 2px; }
          .cv-assign-btn { width: 34px; height: 34px; padding: 0; justify-content: center; gap: 0; }
          .cv-del-conv-btn { width: 34px; height: 34px; }
          .cv-send-label { display: none; }
          .cv-send-btn { padding: 0; width: 44px; height: 44px; justify-content: center; border-radius: 12px; }
          .cv-input-bar { padding: 8px 10px; gap: 6px; }
          .cv-attach-group { display: none; }
          .cv-more-dd { display: block; }
          .cv-notes-sidebar { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; z-index: 400; border-left: none; animation: slideInRight 0.22s ease-out; }
          .cv-header-menu { top: 58px !important; right: 8px !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes popIn { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .tag-chip { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: #fff; white-space: nowrap; }
        .cv-tag-edit-btn { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #a8b8d0; background: #f0f3fa; flex-shrink: 0; }
        .cv-tag-edit-btn:hover { background: #e4eaf5; color: #3563e9; }
        .cv-del-conv-btn.active { background: rgba(53,99,233,0.1); color: #3563e9; }
        .cv-reminder-menu { padding: 0; }
        .cv-reminder-form { display: flex; flex-direction: column; gap: 8px; padding: 4px 14px 14px; }
        .cv-reminder-input { background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 7px; color: #1a2540; padding: 8px 10px; font-size: 13px; outline: none; font-family: inherit; }
        .cv-reminder-input:focus { border-color: #3563e9; }
        .cv-reminder-err { font-size: 12px; color: #e53e3e; }
        .cv-reminder-save { padding: 8px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; background: #3563e9; color: #fff; transition: all 0.15s; }
        .cv-reminder-save:hover { background: #2850cc; }
        .cv-reminder-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .cv-notes-sidebar { width: 320px; flex-shrink: 0; background: #fff; border-left: 1px solid #e4eaf5; padding: 14px 18px; overflow-y: auto; display: flex; flex-direction: column; }
        .cv-notes-sidebar-header { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700; color: #a8b8d0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .cv-notes-sidebar-close { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; flex-shrink: 0; }
        .cv-notes-sidebar-close:hover { background: #f0f3fa; color: #4f607a; }
        .cv-notes-contact { margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
        .cv-notes-contact-name-row { display: flex; align-items: center; gap: 8px; }
        .cv-notes-contact-name { font-size: 14px; font-weight: 700; color: #1a2540; }
        .cv-contact-edit-btn { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: #f0f3fa; color: #3563e9; flex-shrink: 0; transition: background 0.12s; }
        .cv-contact-edit-btn:hover { background: #e4eaf5; }
        .cv-edit-contact { display: flex; flex-direction: column; padding: 18px 20px 20px; }
        .cv-edit-label { font-size: 12px; font-weight: 600; color: #4f607a; margin-bottom: 5px; }
        .cv-edit-input { border: 1px solid #e4eaf5; border-radius: 8px; padding: 9px 11px; font-size: 14px; color: #1a2540; outline: none; margin-bottom: 12px; transition: border 0.12s; }
        .cv-edit-input:focus { border-color: #3563e9; }
        .cv-edit-hint { font-size: 11px; color: #8a9bb8; margin: -6px 0 12px; line-height: 1.4; }
        .cv-edit-error { font-size: 12px; color: #dc2626; margin-bottom: 10px; }
        .cv-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .cv-edit-cancel { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #4f607a; background: #f0f3fa; }
        .cv-edit-cancel:disabled { opacity: 0.5; }
        .cv-edit-save { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #fff; background: #3563e9; }
        .cv-edit-save:disabled { opacity: 0.5; }
        .cv-notes-contact-phone { font-size: 12px; color: #a8b8d0; margin-top: -4px; }
        .cv-notes-contact-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cv-notes-contact-label { font-size: 11px; font-weight: 600; color: #a8b8d0; text-transform: uppercase; letter-spacing: 0.4px; min-width: 48px; flex-shrink: 0; }
        .cv-notes-contact-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cv-notes-empty-inline { font-size: 12px; color: #b8c8d8; }
        .cv-notes-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; max-height: 160px; overflow-y: auto; }
        .cv-notes-loading, .cv-notes-empty { font-size: 12px; color: #a8b8d0; padding: 8px 0; }
        .cv-note-item { background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 8px; padding: 8px 10px; }
        .cv-note-body { font-size: 13px; color: #1a2540; white-space: pre-wrap; margin-bottom: 4px; }
        .cv-note-meta { display: flex; justify-content: space-between; font-size: 10px; color: #a8b8d0; }
        .cv-notes-form { display: flex; flex-direction: column; gap: 6px; }
        .cv-notes-form textarea { background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 8px; color: #1a2540; padding: 8px 10px; font-size: 13px; outline: none; resize: vertical; font-family: inherit; }
        .cv-notes-form textarea:focus { border-color: #3563e9; }
        .cv-notes-form-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .cv-note-ai { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; color: #7c5cd6; background: rgba(124,92,214,0.08); transition: all 0.15s; }
        .cv-note-ai:hover { background: rgba(124,92,214,0.15); }
        .cv-note-ai:disabled { opacity: 0.6; cursor: not-allowed; }
        .cv-note-save { padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; background: #3563e9; color: #fff; transition: all 0.15s; }
        .cv-note-save:hover { background: #2850cc; }
        .cv-note-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .cv-ai-tag-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #7c5cd6; background: rgba(124,92,214,0.08); transition: all 0.15s; margin-bottom: 4px; }
        .cv-ai-tag-btn:hover { background: rgba(124,92,214,0.15); }
        .cv-ai-tag-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cv-ai-tag-reason { font-size: 12px; color: #4f607a; background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 8px; padding: 8px 10px; line-height: 1.4; margin-bottom: 4px; }
        .cv-tag-option.suggested { background: rgba(124,92,214,0.06); box-shadow: inset 0 0 0 1px rgba(124,92,214,0.3); }
        .cv-ai-tag-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: #7c5cd6; margin-left: auto; }
        .cv-history-section { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e4eaf5; }
        .cv-history-title { font-size: 11px; font-weight: 700; color: #a8b8d0; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .cv-history-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
        .cv-history-item { display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left; background: #f7f9fd; border: 1px solid #e4eaf5; border-radius: 8px; padding: 8px 10px; transition: all 0.15s; }
        .cv-history-item:hover { background: #eef4fd; border-color: #c8d4ec; }
        .cv-history-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .cv-history-badge { font-size: 10px; font-weight: 600; padding: 1px 8px; border-radius: 10px; }
        .cv-history-badge.st-open { background: rgba(53,99,233,0.1); color: #3563e9; }
        .cv-history-badge.st-in_progress { background: rgba(208,139,40,0.1); color: #d08b28; }
        .cv-history-badge.st-resolved { background: rgba(39,168,122,0.1); color: #27a87a; }
        .cv-history-time { font-size: 11px; color: #a8b8d0; flex-shrink: 0; }
        .cv-history-preview { font-size: 12px; color: #4f607a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-modal-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .cv-modal { background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; max-height: 90vh; overflow-y: auto; }
        .cv-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e4eaf5; background: #f7f9fd; }
        .cv-modal-header h3 { font-size: 15px; font-weight: 600; color: #1a2540; }
        .cv-modal-close { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; }
        .cv-modal-close:hover { background: #e4eaf5; color: #4f607a; }
        .cv-tag-modal-list { padding: 14px 20px; display: flex; flex-direction: column; gap: 6px; }
        .cv-tag-option { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; transition: background 0.1s; color: #27a87a; }
        .cv-tag-option:hover { background: #f7f9fd; }
        .cv-tag-option.checked { background: rgba(39,168,122,0.06); }
        .cv-tag-option:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

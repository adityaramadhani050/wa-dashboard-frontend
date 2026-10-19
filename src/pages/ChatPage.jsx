import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import {
  getMessages, sendMessage, sendMedia, assignAgent, unassignAgent, getConversation, getConversations, getAgents,
  forwardMessage, deleteMessage, editMessage, sendLocation, sendContact, setConversationRegion,
  getTemplates, getQuickMedia, sendQuickMedia, useTemplate,
  getTags, addTagToConversation, removeTagFromConversation,
  getContactNotes, createContactNote, getContactConversations, getConversationFollowup, getConversationResponseStats, getAiMemory, saveAiMemory, getTeamRequests, deleteConversation,
  generateAiSuggestion, updateContact,
} from '../hooks/useApi'
import { supabase } from '../lib/supabase'
import PdfThumb, { isPdf } from '../components/PdfThumb'
import FollowupPanel from '../components/FollowupPanel'
import { dueTone } from '../components/followupUi'
import { formatDurShort, formatDurLong } from '../lib/duration'
import { useAiAgentId } from '../hooks/useAiAgent'
import { teamStatus } from '../components/AiTeamPanel'
import AiCorrectionModal from '../components/AiCorrectionModal'
import { Send, ArrowLeft, ArrowDown, UserCheck, Paperclip, X, FileText, Play, Download, Check, Image, Film, Clock, Zap, Package, Tag as TagIcon, StickyNote, MoreVertical, Sparkles, Reply, Pencil, Forward, Search as SearchIcon, Trash2, Copy, MapPin, User, Bot, PanelRight, ExternalLink, Phone, GraduationCap, Brain, Users } from 'lucide-react'


const MSG_PAGE = 60 // jumlah pesan per halaman (muat bertahap saat scroll ke atas)

const AVATAR_COLORS = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
function avatarStyle(name) {
  const letter = (name || '?')[0].toUpperCase()
  const c = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  return { background: c + '22', color: c }
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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

function ImgMedia({ url, thumb, caption, sent, expired, onImageClick }) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Tampilkan thumbnail (kecil, cepat) bila ada; klik buka full-res di lightbox.
  const displaySrc = thumb || url
  // Gambar hilang/kadaluarsa/gagal dimuat -> tampilkan info di aplikasi, JANGAN
  // membuka URL mentah (agar tidak diarahkan ke halaman 404 storage).
  if (expired || !displaySrc || error) {
    return (
      <div className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}>
        <Image size={26} strokeWidth={1.5} />
        <div className="cv-media-broken-info">
          <span>Foto</span>
          <span className="cv-media-broken-sub">{expired ? 'Telah dihapus' : 'Gambar tidak tersedia'}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="cv-media-wrap">
      {!loaded && <div className="cv-media-skeleton"><div className="cv-media-skel-inner" /></div>}
      <img src={displaySrc} className="cv-media-img" alt="foto"
        style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)} onError={() => setError(true)}
        onClick={() => onImageClick(url || displaySrc)} />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function VideoMedia({ url, caption, sent, expired }) {
  const [error, setError] = useState(false)
  if (expired || !url || error) {
    return (
      <div className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}>
        <Film size={26} strokeWidth={1.5} />
        <div className="cv-media-broken-info"><span>Video</span><span className="cv-media-broken-sub">{expired ? 'Telah dihapus' : 'Video tidak tersedia'}</span></div>
      </div>
    )
  }
  return (
    <div className="cv-media-wrap">
      <video src={url} controls className="cv-media-video" onError={() => setError(true)} />
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function DocMedia({ url, filename, caption, sent, expired }) {
  const [dlStatus, setDlStatus] = useState('idle')
  const [gone, setGone] = useState(false)
  const ext = filename?.split('.').pop()?.toUpperCase() || 'FILE'
  const handleClick = async (e) => {
    e.preventDefault()
    if (dlStatus === 'downloading') return
    setDlStatus('downloading')
    // Cek dulu apakah file masih ada sebelum membuka (hindari redirect ke 404)
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (!res.ok) { setGone(true); setDlStatus('idle'); return }
    } catch {
      setGone(true); setDlStatus('idle'); return
    }
    // File tersedia -> buka/unduh
    window.open(url, '_blank', 'noopener,noreferrer')
    setDlStatus('done')
  }
  if (expired || !url || gone) {
    return (
      <div className="cv-media-wrap">
        <div className={`cv-media-broken ${sent ? 'sent' : 'recv'}`}>
          <FileText size={26} strokeWidth={1.5} />
          <div className="cv-media-broken-info"><span>{filename || 'Dokumen'}</span><span className="cv-media-broken-sub">{expired || gone ? 'Telah dihapus' : 'Tidak tersedia'}</span></div>
        </div>
        {caption && <p className="cv-media-caption">{caption}</p>}
      </div>
    )
  }
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
          <span className="cv-media-doc-sub">{dlStatus === 'idle' ? 'Tap untuk unduh' : dlStatus === 'downloading' ? 'Memeriksa...' : 'Terbuka ✓'}</span>
        </div>
      </a>
      {caption && <p className="cv-media-caption">{caption}</p>}
    </div>
  )
}

function ShareModal({ mode, onClose, onSendLocation, onSendContact, loading }) {
  const isLoc = mode === 'location'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [address, setAddress] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoErr, setGeoErr] = useState('')

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoErr('Perangkat tidak mendukung lokasi'); return }
    setGeoBusy(true); setGeoErr('')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(String(pos.coords.latitude)); setLng(String(pos.coords.longitude)); setGeoBusy(false) },
      () => { setGeoErr('Gagal ambil lokasi. Izinkan akses lokasi atau isi manual.'); setGeoBusy(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (isLoc) {
      if (!lat || !lng) return
      onSendLocation({ latitude: lat, longitude: lng, name: name || undefined, address: address || undefined })
    } else {
      if (!name.trim() || !phone.trim()) return
      onSendContact({ name: name.trim(), phone })
    }
  }

  return (
    <div className="cv-share-overlay" onClick={onClose}>
      <div className="cv-share-modal" onClick={e => e.stopPropagation()}>
        <div className="cv-share-head">
          <span className="cv-share-title">{isLoc ? <MapPin size={16} /> : <User size={16} />}{isLoc ? 'Kirim lokasi' : 'Kirim kontak'}</span>
          <button className="cv-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="cv-share-form">
          {isLoc ? (
            <>
              <button type="button" className="cv-share-geo" onClick={useMyLocation} disabled={geoBusy}>
                <MapPin size={15} /> {geoBusy ? 'Mengambil lokasi…' : 'Gunakan lokasi saya'}
              </button>
              {geoErr && <div className="cv-share-err">{geoErr}</div>}
              <div className="cv-share-grid">
                <div><label>Latitude</label><input value={lat} onChange={e => setLat(e.target.value)} placeholder="-7.2575" inputMode="decimal" /></div>
                <div><label>Longitude</label><input value={lng} onChange={e => setLng(e.target.value)} placeholder="112.7521" inputMode="decimal" /></div>
              </div>
              <label>Nama tempat (opsional)</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="mis. Kantor Renus" />
              <label>Alamat (opsional)</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. ..." />
            </>
          ) : (
            <>
              <label>Nama</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama kontak" />
              <label>Nomor (dengan kode negara)</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="628123456789" inputMode="tel" />
            </>
          )}
          <div className="cv-share-actions">
            <button type="button" className="cv-share-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="cv-share-send" disabled={loading}>{loading ? 'Mengirim…' : 'Kirim'}</button>
          </div>
        </form>
      </div>
      <style>{`
        .cv-share-overlay { position: fixed; inset: 0; background: var(--scrim); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.15s ease; }
        .cv-share-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .cv-share-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
        .cv-share-title { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text); }
        .cv-share-title svg { color: var(--primary); }
        .cv-share-form { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 6px; }
        .cv-share-form label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin: 6px 0 5px; }
        .cv-share-form input { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 9px; font-size: 13.5px; background: var(--surface2); color: var(--text); outline: none; transition: border-color 0.15s; }
        .cv-share-form input:focus { border-color: var(--primary); background: var(--surface); }
        .cv-share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cv-share-geo { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; border-radius: 9px; background: var(--primary-light); color: var(--primary); font-weight: 600; font-size: 13px; }
        .cv-share-geo:disabled { opacity: 0.7; }
        .cv-share-err { font-size: 12px; color: var(--danger, #e53e3e); }
        .cv-share-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        .cv-share-cancel { height: 38px; padding: 0 16px; border-radius: 9px; background: var(--surface3); color: var(--text2); font-weight: 600; font-size: 13px; }
        .cv-share-send { height: 38px; padding: 0 20px; border-radius: 9px; background: var(--primary); color: var(--on-primary); font-weight: 600; font-size: 13px; }
        .cv-share-send:disabled { opacity: 0.6; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}

function MediaContent({ msg, sent, onImageClick }) {
  const { media_type, media_url, media_filename, body } = msg
  const caption = body && !body.startsWith('[') ? body : null
  if (!media_url && !media_type) return <p>{msg.body || msg.content || msg.text}</p>
  // Kontak & lokasi (dari WhatsApp) -> kartu khusus, bisa diklik
  if (media_type === 'contact' || media_type === 'location') {
    const isLoc = media_type === 'location'
    const text = (body || '').replace(/^📍\s?|^📇\s?/, '') || (isLoc ? 'Lokasi' : 'Kontak')
    // Baris pertama = nama tempat/kontak, sisanya = alamat
    const [title, ...rest] = text.split('\n')
    const detail = isLoc ? rest.join(', ') : (media_filename ? `+${String(media_filename).replace(/^\+/, '')}` : '')
    const inner = (
      <div className={`cv-special-card ${sent ? 'sent' : 'recv'}`}>
        <span className={`cv-special-icon ${isLoc ? 'loc' : 'contact'}`}>{isLoc ? <MapPin size={18} /> : <User size={18} />}</span>
        <div className="cv-special-info">
          <span className="cv-special-title">{title || (isLoc ? 'Lokasi' : 'Kontak')}</span>
          {detail && <span className="cv-special-detail">{detail}</span>}
          {(media_url || detail) && (
            <span className="cv-special-action">
              {isLoc ? <><ExternalLink size={11} /> Buka di Google Maps</> : media_url ? <><Phone size={11} /> Chat kontak ini</> : null}
            </span>
          )}
        </div>
      </div>
    )
    return media_url
      ? <a href={media_url} target="_blank" rel="noreferrer" className="cv-special-link">{inner}</a>
      : inner
  }
  if (media_type && !media_url) {
    // Media dihapus karena kadaluarsa (TTL) -> tampilkan info, bukan skeleton
    if (msg.media_expired) {
      return <div className="cv-media-placeholder"><Clock size={15} /><span>Media kadaluarsa & telah dihapus</span>{caption && <p className="cv-media-caption">{caption}</p>}</div>
    }
    // Media sedang diunduh di server, URL menyusul
    if (media_type === 'image' || media_type === 'video')
      return <div className="cv-media-wrap"><div className="cv-media-skeleton"><div className="cv-media-skel-inner" /></div></div>
    return <div className="cv-media-placeholder"><Paperclip size={16} /><span>Memuat {media_type}…</span></div>
  }
  if (media_type === 'sticker') return <div className="cv-sticker-wrap"><img src={media_url} alt="stiker" className="cv-sticker" />{caption && <p className="cv-media-caption">{caption}</p>}</div>
  if (media_type === 'image') return <ImgMedia url={media_url} thumb={msg.media_thumb_url} caption={caption} sent={sent} expired={msg.media_expired} onImageClick={onImageClick} />
  if (media_type === 'video') return <VideoMedia url={media_url} caption={caption} sent={sent} expired={msg.media_expired} />
  if (media_type === 'audio') return <div className="cv-media-audio-wrap"><audio src={media_url} controls className="cv-media-audio" />{caption && <p className="cv-media-caption">{caption}</p>}</div>
  if (media_type === 'document') return <DocMedia url={media_url} filename={media_filename} caption={caption} sent={sent} expired={msg.media_expired} />
  return <div className="cv-media-placeholder"><Paperclip size={16} /><span>{media_filename || body || '[media]'}</span></div>
}

function ImageLightbox({ url, onClose }) {
  const [error, setError] = useState(false)
  if (!url) return null
  return (
    <div className="cv-lightbox" onClick={onClose}>
      <button className="cv-lightbox-close" onClick={onClose}><X size={24} /></button>
      {error ? (
        <div className="cv-lightbox-msg" onClick={e => e.stopPropagation()}>
          <Image size={40} strokeWidth={1.5} />
          <span>Gambar tidak tersedia (telah dihapus)</span>
        </div>
      ) : (
        <img src={url} className="cv-lightbox-img" onClick={e => e.stopPropagation()} onError={() => setError(true)} alt="preview" />
      )}
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
function SwipeMessageRow({ msg, sent, isSending, hasMedia, hasReply, name, grpStart, onReply, onForward, onDelete, onEdit, canEdit, onMenu, onQuoteClick, onImageClick, onCorrect }) {
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
      className={`cv-row ${sent ? 'sent' : 'recv'}${grpStart ? ' grp-start' : ''}`}
      id={msg.wa_message_id ? `m-${msg.wa_message_id}` : undefined}
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
          {canEdit && <button className="cv-hover-btn" title="Edit" onClick={onEdit}><Pencil size={14} /></button>}
          {onCorrect && <button className="cv-hover-btn ai" title="Koreksi balasan AI" onClick={onCorrect}><GraduationCap size={14} /></button>}
          <button className="cv-hover-btn" title="Teruskan" onClick={onForward}><Forward size={14} /></button>
          <button className="cv-hover-btn danger" title="Hapus" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      )}
      <div
        className={`cv-bubble ${sent ? 'bsent' : 'brecv'} ${hasMedia ? 'media' : ''} ${isSending ? 'sending' : ''}`}
        style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, transition: dragX ? 'none' : 'transform 0.18s ease' }}
      >
        {hasReply && (
          <div
            className={`cv-quote ${sent ? 'on-sent' : 'on-recv'}${msg.reply_to_wa_id ? ' clickable' : ''}`}
            onClick={(e) => { if (msg.reply_to_wa_id) { e.stopPropagation(); onQuoteClick?.(msg.reply_to_wa_id) } }}
          >
            <span className="cv-quote-who">{msg.reply_to_from_me ? 'Anda' : name}</span>
            <span className="cv-quote-text">{msg.reply_to_body || 'Pesan'}</span>
          </div>
        )}
        {hasMedia
          ? <MediaContent msg={msg} sent={sent} onImageClick={onImageClick} />
          : <p>{msg.body || msg.content || msg.text}</p>
        }
        <div className="cv-meta">
          {msg.sent_by_bot && <span className="cv-bot-tag" title="Dikirim otomatis oleh bot"><Bot size={11} />Bot</span>}
          {msg.sent_by_ai && <span className="cv-bot-tag ai" title="Dikirim oleh AI Sales"><Sparkles size={10} />AI</span>}
          {msg.edited && <span className="cv-edited">Diedit</span>}
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
  const [shareModal, setShareModal] = useState(null) // null | 'location' | 'contact'
  const [sharing, setSharing] = useState(false)
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

  // Keyboard terbuka? (fokus input) -> pesan menempel ke bawah; jika tertutup rata atas
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // Menu aksi pesan (long-press mobile)
  const [actionMsg, setActionMsg] = useState(null)
  const [correctMsg, setCorrectMsg] = useState(null) // koreksi balasan AI (admin)
  const [toast, setToast] = useState('')
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [editingMsg, setEditingMsg] = useState(null) // pesan yang sedang diedit

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

  // Follow-up otomatis (menggantikan pengingat manual)
  const [fuData, setFuData] = useState(null)

  const bottomRef = useRef(null)
  const messagesRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const loadingOlderRef = useRef(false)
  const hasMoreRef = useRef(false)
  const prependingRef = useRef(false)
  const setHasMoreBoth = (v) => { hasMoreRef.current = v; setHasMore(v) }
  const { newMessages, statusUpdates, messageUpdates, assignmentUpdates, conversationUpdates, deletedMessages } = useSocket()
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [msgs, conv] = await Promise.all([getMessages(id, { limit: MSG_PAGE }), getConversation(id)])
      const arr = Array.isArray(msgs) ? msgs : []
      setMessages(arr)
      setHasMoreBoth(arr.length >= MSG_PAGE) // kemungkinan masih ada pesan lebih lama
      setConversation(conv || null)
      setError('')
    } catch { setError('Gagal memuat pesan.') }
    finally { setLoading(false) }
  }, [id])

  // Muat satu halaman pesan lebih lama. Return Promise<boolean> (true jika ada
  // pesan baru dimuat). Dipakai oleh scroll otomatis & auto-load saat klik quote.
  const loadOlder = useCallback((restoreScroll = true) => {
    return new Promise((resolve) => {
      const el = messagesRef.current
      setMessages(prev => {
        if (loadingOlderRef.current || !hasMoreRef.current || !prev.length) { resolve(false); return prev }
        loadingOlderRef.current = true
        setLoadingOlder(true)
        const oldest = prev[0]
        const prevHeight = el ? el.scrollHeight : 0
        const prevTop = el ? el.scrollTop : 0
        getMessages(id, { limit: MSG_PAGE, before: oldest.timestamp || oldest.createdAt })
          .then((older) => {
            const list = Array.isArray(older) ? older : []
            if (list.length) {
              prependingRef.current = true
              setMessages(cur => {
                const seen = new Set(cur.map(m => String(m.id)))
                const fresh = list.filter(m => !seen.has(String(m.id)))
                return fresh.length ? [...fresh, ...cur] : cur
              })
              if (restoreScroll) {
                requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop })
              }
            }
            setHasMoreBoth(list.length >= MSG_PAGE)
            resolve(list.length > 0)
          })
          .catch(() => resolve(false))
          .finally(() => { loadingOlderRef.current = false; setLoadingOlder(false) })
        return prev
      })
    })
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
      for (const { message } of relevant) {
        // new_message hanya untuk pesan BARU. Jangan timpa pesan yang sudah ada
        // (mencegah edit/status ter-reset saat buffer newMessages diproses ulang).
        // Kecuali placeholder optimistik (tmp-) yang memang perlu diganti.
        const exists = message?.id && next.some(m => String(m.id) === String(message.id))
        if (!exists) next = mergeMessage(next, message)
      }
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

  // Regional / status bot lokasi berubah (bot menjawab, admin mengganti regional)
  useEffect(() => {
    const relevant = (conversationUpdates || []).filter(u => String(u.conversationId) === String(id))
    if (!relevant.length) return
    // Chat dihapus (oleh admin lain) -> kembali ke daftar chat
    if (relevant.some(u => u.deleted)) { navigate('/inbox', { replace: true }); return }
    setConversation(prev => {
      if (!prev) return prev
      let next = { ...prev, contact: prev.contact ? { ...prev.contact } : prev.contact }
      for (const u of relevant) {
        if (u.region !== undefined) { next.region = u.region; if (next.contact) next.contact.region = u.region }
        if (u.bot_state !== undefined) next.bot_state = u.bot_state
        if (next.contact && u.city !== undefined) next.contact.city = u.city
        if (next.contact && u.province !== undefined) next.contact.province = u.province
      }
      return next
    })
  }, [conversationUpdates, id, navigate])

  const scrolledForRef = useRef(null)

  useEffect(() => {
    // Jangan lompat ke bawah saat menyisipkan pesan lama (prepend) — pertahankan posisi.
    if (prependingRef.current) { prependingRef.current = false; return }
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
      // Dekat atas -> muat pesan lebih lama otomatis
      if (el.scrollTop < 150 && hasMore && !loadingOlderRef.current) loadOlder()
    }
    handleScroll()
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [id, hasMore, loadOlder])

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  // Klik kutipan balasan -> lompat ke pesan aslinya & sorot sebentar (seperti WhatsApp).
  // Jika pesan asli belum dimuat (karena paginasi), muat pesan lama otomatis sampai ketemu.
  const scrollToReplied = async (waId) => {
    if (!waId) return
    const flashTarget = () => {
      const el = document.getElementById(`m-${waId}`)
      if (!el) return false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('flash')
      void el.offsetWidth // reflow agar animasi bisa diputar ulang
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1400)
      return true
    }
    if (flashTarget()) return
    // Muat bertahap ke belakang (maks 40 halaman) sampai pesan asli muncul
    for (let i = 0; i < 40 && hasMoreRef.current; i++) {
      const got = await loadOlder(false)
      await new Promise(r => setTimeout(r, 60)) // beri waktu React merender
      if (flashTarget()) return
      if (!got) break
    }
    if (!flashTarget()) setError('Pesan asli tidak ditemukan.')
  }
  // Tempel ke bawah secara instan (dipakai saat keyboard buka/viewport berubah)
  const stickToBottom = useCallback(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  // Saat input difokus (keyboard terbuka): pesan menempel ke bawah & scroll ke terbaru.
  const handleInputFocus = () => { setKeyboardOpen(true); stickToBottom(); setTimeout(stickToBottom, 150); setTimeout(stickToBottom, 350) }
  // Saat input blur (keyboard tertutup): kembali rata atas.
  const handleInputBlur = () => setKeyboardOpen(false)
  // Keyboard mengubah tinggi viewport -> jaga tetap menempel ke bawah.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => { if (document.activeElement === textareaRef.current) stickToBottom() }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [stickToBottom])

  const closeMenus = () => { setShowAgentMenu(false); setShowTemplateMenu(false); setShowMediaGallery(false); setShowMoreMenu(false); setShowAiMenu(false) }

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
    if (editingMsg) { handleEditSubmit(); return }
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
    const caption = text.trim()
    setSelectedFile(null)
    setReplyTo(null)
    setText('')
    // Placeholder optimistik agar file langsung tampil dgn indikator jam saat kirim.
    const tempId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, from_me: true, status: 'sent',
      media_type: f.type, media_url: f.previewUrl || null,
      media_thumb_url: f.previewUrl || null, media_filename: f.file?.name,
      body: caption || `[${f.type}]`, timestamp: new Date().toISOString(),
    }])
    try {
      await sendMedia(id, f.file, caption || undefined, currentReply)
      await fetchData()
    } catch (e) {
      setMessages(prev => prev.filter(m => String(m.id) !== tempId))
      setError(e?.response?.data?.error || 'Gagal mengirim file.')
      setSelectedFile(f); setReplyTo(currentReply); setText(caption)
    } finally { setSending(false) }
  }

  const isMobileDevice = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && editingMsg) { e.preventDefault(); cancelEdit(); return }
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
    // Placeholder optimistik agar user langsung lihat media sedang dikirim (ada
    // indikator jam) -> mencegah kesan "tidak terkirim" & kirim berulang.
    const tempId = `tmp-${Date.now()}`
    const mtype = item.media_type || 'document'
    setMessages(prev => [...prev, {
      id: tempId, from_me: true, status: 'sent',
      media_type: mtype, media_url: item.media_url || null,
      media_thumb_url: item.media_url || null, media_filename: item.label,
      body: `[${mtype}]`, timestamp: new Date().toISOString(),
    }])
    try {
      await sendQuickMedia(id, item.id, undefined, currentReply)
      await fetchData()
    } catch (e) {
      setMessages(prev => prev.filter(m => String(m.id) !== tempId))
      setError(e?.response?.data?.error || 'Gagal mengirim media.')
      setReplyTo(currentReply)
    } finally { setSendingQuickMediaId(null) }
  }

  const handleSendLocation = async ({ latitude, longitude, name, address }) => {
    setSharing(true)
    try {
      await sendLocation(id, { latitude, longitude, name, address })
      setShareModal(null)
      await fetchData()
    } catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim lokasi.') }
    finally { setSharing(false) }
  }

  const handleSendContact = async ({ name, phone }) => {
    setSharing(true)
    try {
      await sendContact(id, { name, phone })
      setShareModal(null)
      await fetchData()
    } catch (e) { setError(e?.response?.data?.error || 'Gagal mengirim kontak.') }
    finally { setSharing(false) }
  }

  // Admin menentukan/mengganti regional chat -> bila belum ada agent, langsung
  // diarahkan ke agent regional tsb (backend).
  const [regionBusy, setRegionBusy] = useState(false)
  const handleSetRegion = async (region) => {
    if (regionBusy) return
    setRegionBusy(true)
    try {
      const r = await setConversationRegion(id, region)
      setConversation(p => p ? {
        ...p, region, bot_state: 'done',
        contact: p.contact ? { ...p.contact, region } : p.contact,
        ...(r?.agent ? { agents: r.agent, status: 'in_progress' } : {}),
      } : p)
      window.dispatchEvent(new Event('cv:conversation-updated'))
      setShowAgentMenu(false)
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal mengubah regional chat.')
    } finally { setRegionBusy(false) }
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
    try {
      await navigator.clipboard.writeText(text)
      setToast('Pesan disalin')
      setTimeout(() => setToast(''), 1800)
    }
    catch { setError('Gagal menyalin pesan.') }
  }

  // Boleh diedit: pesan keluar, teks (bukan media), sudah terkirim (punya wa id),
  // dan belum lewat 15 menit (aturan WhatsApp).
  const canEditMessage = (msg) => {
    if (!msg || !isFromMe(msg)) return false
    if (msg.media_type) return false
    if (String(msg.id).startsWith('tmp-') || !msg.wa_message_id) return false
    const ts = new Date(msg.timestamp || msg.createdAt).getTime()
    return Number.isFinite(ts) && (Date.now() - ts) < 15 * 60 * 1000
  }

  const startEditMessage = (msg) => {
    setActionMsg(null)
    setReplyTo(null)
    setSelectedFile(null)
    setEditingMsg(msg)
    setText(msg.body || '')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const cancelEdit = () => { setEditingMsg(null); setText('') }

  const handleEditSubmit = async () => {
    const body = text.trim()
    const target = editingMsg
    if (!body || !target) return
    setEditingMsg(null); setText('')
    try {
      await editMessage(target.id, body)
      setMessages(prev => prev.map(m => String(m.id) === String(target.id) ? { ...m, body, edited: true } : m))
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal mengedit pesan.')
      setEditingMsg(target); setText(body)
    }
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
    if (next) { loadNotes(); loadHistory(); loadFollowup() }
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

  const loadFollowup = useCallback(() => {
    getConversationFollowup(id).then(setFuData).catch(() => {})
  }, [id])
  useEffect(() => { loadFollowup() }, [loadFollowup])

  // Rata-rata waktu respons agent di chat ini (dimuat saat panel Detail dibuka)
  const [respStats, setRespStats] = useState(null)
  const loadRespStats = useCallback(() => {
    getConversationResponseStats(id).then(setRespStats).catch(() => setRespStats(null))
  }, [id])
  useEffect(() => { setRespStats(null) }, [id])
  useEffect(() => { if (showNotesPanel) loadRespStats() }, [showNotesPanel, loadRespStats])

  // Ingatan AI Sales tentang customer ini (dibuat otomatis dari percakapan dengan AI)
  const [aiMemory, setAiMemory] = useState(null)
  const [memEditing, setMemEditing] = useState(false)
  const [memDraft, setMemDraft] = useState('')
  const [memBusy, setMemBusy] = useState(false)
  const contactIdForMem = conversation?.contact?.id
  useEffect(() => { setAiMemory(null); setMemEditing(false) }, [id])
  useEffect(() => {
    if (!showNotesPanel || !contactIdForMem) return
    getAiMemory(contactIdForMem).then(setAiMemory).catch(() => setAiMemory(null))
  }, [showNotesPanel, contactIdForMem])
  const saveMemory = async () => {
    setMemBusy(true)
    try { setAiMemory(await saveAiMemory(contactIdForMem, memDraft)); setMemEditing(false) } catch {}
    finally { setMemBusy(false) }
  }
  // Hapus chat (admin): semua pesan & file media di chat ini
  const [showDeleteChat, setShowDeleteChat] = useState(false)
  const [deletingChat, setDeletingChat] = useState(false)
  const [deleteChatError, setDeleteChatError] = useState('')
  const handleDeleteChat = async () => {
    setDeletingChat(true); setDeleteChatError('')
    try {
      await deleteConversation(id)
      setShowDeleteChat(false)
      navigate('/inbox', { replace: true })
    } catch (e) {
      setDeleteChatError(e?.response?.data?.error || 'Gagal menghapus chat')
    } finally { setDeletingChat(false) }
  }

  // Tanya Tim: pertanyaan AI ke divisi internal untuk chat ini
  const [teamReqs, setTeamReqs] = useState([])
  const loadTeamReqs = useCallback(() => {
    if (!id) return
    getTeamRequests({ conversation_id: id, limit: 10 }).then(d => setTeamReqs(d?.requests || [])).catch(() => setTeamReqs([]))
  }, [id])
  useEffect(() => { setTeamReqs([]) }, [id])
  useEffect(() => { if (showNotesPanel) loadTeamReqs() }, [showNotesPanel, loadTeamReqs])
  // Ada pesan baru (masuk/keluar) saat panel terbuka -> hitung ulang (ditunda
  // sebentar agar pesan keluar sudah tersimpan di server).
  const lastMsgKey = messages.length ? String(messages[messages.length - 1].id) : ''
  useEffect(() => {
    if (!showNotesPanel || !lastMsgKey) return
    const t = setTimeout(() => { loadRespStats(); loadTeamReqs() }, 1500)
    return () => clearTimeout(t)
  }, [lastMsgKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const name = conversation?.contact?.name || conversation?.contact?.phone || 'Unknown'
  const phone = conversation?.contact?.manual_wa_number || cleanPhone(conversation?.contact?.phone)
  const assignedAgent = conversation?.agents
  const aiAgentId = useAiAgentId()
  const isAiChat = !!(aiAgentId && assignedAgent && String(assignedAgent.id) === aiAgentId)
  const chatRegionVal = conversation?.region || conversation?.contact?.region || null

  const messageItems = []
  let lastDateKey = null
  // Urutkan kronologis (pesan hasil sinkronisasi bisa masuk tidak berurutan)
  const orderedMessages = [...messages].sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime()
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime()
    return ta - tb
  })
  let prevSent = null
  for (const msg of orderedMessages) {
    const ts = msg.timestamp || msg.createdAt
    const dk = getDateKey(ts)
    if (dk && dk !== lastDateKey) { messageItems.push({ type: 'date', key: dk, label: formatDateLabel(ts) }); lastDateKey = dk; prevSent = null }
    // Awal kelompok = pengirim berganti -> beri jarak lebih (seperti WhatsApp)
    const sentNow = !!isFromMe(msg)
    messageItems.push({ type: 'msg', msg, grpStart: prevSent !== sentNow })
    prevSent = sentNow
  }
  const dayGroups = []
  for (const item of messageItems) {
    if (item.type === 'date' || !dayGroups.length) dayGroups.push({ key: item.type === 'date' ? item.key : 'day-0', label: item.type === 'date' ? item.label : null, items: [] })
    if (item.type !== 'date') dayGroups[dayGroups.length - 1].items.push(item)
  }

  return (
    <div className={`cv-root${showNotesPanel ? ' with-sidebar' : ''}${keyboardOpen ? ' kb-open' : ''}`} onClick={closeMenus}>
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
            {isAdmin && assignedAgent && <span className={`cv-assigned${isAiChat ? ' ai' : ''}`} title={isAiChat ? 'Dibalas otomatis oleh AI Sales. Assign ke agent lain untuk mengambil alih.' : undefined}>{isAiChat ? <Sparkles size={10} /> : <UserCheck size={10} />}{assignedAgent.name}{isAiChat ? ' · AI' : ''}</span>}
            {isAdmin && !assignedAgent && <span className="cv-unassigned">Unassigned</span>}
            {isAdmin && conversation?.bot_state === 'awaiting_location' && (
              <span className="cv-region-badge bot"><Bot size={10} />Bot bertanya lokasi</span>
            )}
            {isAdmin && conversation?.bot_state !== 'awaiting_location' && chatRegionVal && (
              <span className={`cv-region-badge ${chatRegionVal}`} title={[conversation?.contact?.city, conversation?.contact?.province].filter(Boolean).join(', ') || undefined}>
                <MapPin size={10} />{chatRegionVal === 'barat' ? 'Barat' : 'Timur'}{conversation?.contact?.city ? ` · ${conversation.contact.city}` : ''}
              </span>
            )}
            {isAdmin && conversation?.bot_state === 'unresolved' && !chatRegionVal && (
              <span className="cv-region-badge unknown" title="Lokasi tidak terdeteksi — tentukan lewat menu Assign">Regional?</span>
            )}
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
              <button className={`cv-hdr-btn cv-assign-btn${showAgentMenu ? ' active' : ''}`} onClick={() => setShowAgentMenu(!showAgentMenu)} title="Assign agent & regional">
                <UserCheck size={16} /><span className="cv-btn-label">Assign</span>
              </button>
              {showAgentMenu && (
                <div className="cv-menu cv-header-menu" style={{minWidth:200}}>
                  <div className="cv-menu-lbl">Assign ke Agent</div>
                  {agents.length === 0
                    ? <div className="cv-mi muted">Tidak ada agent</div>
                    : agents.map(a => (
                      <button key={a.id} className={`cv-mi cv-mi-agent${assignedAgent?.id === a.id ? ' active' : ''}`} onClick={() => handleAgentAssign(a)}>
                        <span className="cv-mi-av" style={avatarStyle(a.name)}>{(a.name || '?')[0].toUpperCase()}</span>
                        <span className="cv-mi-agent-info">
                          <span className="cv-mi-agent-name">{a.name}</span>
                          <span className="cv-mi-sub">
                            {a.region ? `${a.region === 'barat' ? 'Barat' : 'Timur'} · ` : ''}{a.username ? `@${a.username}` : a.email}
                          </span>
                        </span>
                        {assignedAgent?.id === a.id && <Check size={15} className="cv-mi-check" />}
                      </button>
                    ))
                  }
                  {assignedAgent && (
                    <button className="cv-mi cv-mi-unassign" onClick={handleUnassign}>
                      <span><X size={13} style={{verticalAlign:-2,marginRight:5}} />Hapus assign</span>
                    </button>
                  )}
                  <div className="cv-menu-lbl">Regional chat</div>
                  <div className="cv-region-pick">
                    {['barat', 'timur'].map(r => (
                      <button
                        key={r}
                        className={`cv-region-opt ${r}${chatRegionVal === r ? ' active' : ''}`}
                        disabled={regionBusy}
                        onClick={() => handleSetRegion(r)}
                        title={assignedAgent ? 'Ubah regional chat' : 'Tentukan regional & bagikan ke agent regional tsb'}
                      >{r === 'barat' ? 'Barat' : 'Timur'}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button className={`cv-hdr-btn cv-notes-btn${showNotesPanel ? ' active' : ''}`} title="Detail chat: kontak, follow-up, catatan & riwayat" onClick={handleToggleNotesPanel}>
            <PanelRight size={16} /><span className="cv-btn-label">Detail</span>
            {fuData?.current && ['today', 'late'].includes(dueTone(fuData.current)) && (
              <span className={`cv-fu-dot ${dueTone(fuData.current)}`} title="Ada follow-up jatuh tempo" />
            )}
          </button>
        </div>
      </div>

      {showTagModal && (
        <Modal title="Atur Label Percakapan" onClose={() => setShowTagModal(false)}>
          <div className="cv-tag-modal-list">
            {allTags.length === 0 ? (
              <div className="cv-mi muted">Belum ada tag. Buat di halaman Template & Galeri.</div>
            ) : allTags.map(t => {
              const checked = conversationTags.some(ct => ct.id === t.id)
              return (
                <button
                  key={t.id}
                  className={`cv-tag-option${checked ? ' checked' : ''}`}
                  disabled={!!tagToggling}
                  onClick={() => handleToggleTag(t)}
                >
                  <span className={`cv-tag-check${checked ? ' on' : ''}`}>
                    {tagToggling === t.id ? <span className="cv-sending-dot dark" /> : checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {toast && (
        <div className="cv-toast"><Check size={14} /> {toast}</div>
      )}

      {shareModal && (
        <ShareModal mode={shareModal} loading={sharing}
          onClose={() => setShareModal(null)}
          onSendLocation={handleSendLocation}
          onSendContact={handleSendContact} />
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
            {canEditMessage(actionMsg) && (
              <button className="cv-sheet-item" onClick={() => startEditMessage(actionMsg)}>
                <Pencil size={18} /> Edit
              </button>
            )}
            <button className="cv-sheet-item" onClick={() => { const m = actionMsg; setActionMsg(null); openForward(m) }}>
              <Forward size={18} /> Teruskan
            </button>
            {isAdmin && actionMsg.sent_by_ai && (
              <button className="cv-sheet-item" onClick={() => { const m = actionMsg; setActionMsg(null); setCorrectMsg(m) }}>
                <GraduationCap size={18} /> Koreksi balasan AI
              </button>
            )}
            <button className="cv-sheet-item danger" onClick={() => handleDeleteMessage(actionMsg)}>
              <Trash2 size={18} /> Hapus
            </button>
            <button className="cv-sheet-cancel" onClick={() => setActionMsg(null)}>Batal</button>
          </div>
        </div>
      )}

      {correctMsg && <AiCorrectionModal msg={correctMsg} onClose={() => setCorrectMsg(null)} />}

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
      <div className={`cv-messages${keyboardOpen ? ' kb-open' : ''}`} ref={messagesRef}>
        {loadingOlder && (
          <div className="cv-load-older"><div className="cv-forward-spinner" /></div>
        )}
        {!loading && conversation && !hasMore && (
          <div className="cv-contact-card">
            <div className="cv-cc-avatar">{(name || '?')[0].toUpperCase()}</div>
            <div className="cv-cc-name">{name}</div>
            {phone && <div className="cv-cc-phone">{phone}</div>}
            {(assignedAgent || conversationTags.length > 0) && (
              <div className="cv-cc-meta">
                {assignedAgent && <span className="cv-cc-agent"><UserCheck size={12} />{assignedAgent.name}</span>}
                {conversationTags.map(t => (
                  <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="cv-msg-spacer" />
        {loading ? (
          <div className="cv-loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`cv-skel ${i%2===0?'left':'right'}`} style={{animationDelay:`${i*0.1}s`}} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="cv-empty">Belum ada pesan. Sapa dulu! 👋</div>
        ) : (
          // Dikelompokkan per hari: badge tanggal (sticky) hanya menempel selama
          // hari itu terlihat, lalu terdorong keluar (tidak menumpuk dengan hari lain)
          dayGroups.map(group => (
            <div key={group.key} className="cv-day">
              {group.label && <DateSeparator label={group.label} />}
              {group.items.map((item, i) => {
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
                grpStart={item.grpStart}
                onReply={() => handleReplyTo(msg)}
                onForward={() => openForward(msg)}
                onDelete={() => handleDeleteMessage(msg)}
                onEdit={() => startEditMessage(msg)}
                canEdit={canEditMessage(msg)}
                onMenu={() => setActionMsg(msg)}
                onQuoteClick={scrollToReplied}
                onImageClick={setLightboxUrl}
                onCorrect={isAdmin && msg.sent_by_ai ? () => setCorrectMsg(msg) : undefined}
              />
            )
              })}
            </div>
          ))
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
            {selectedFile.type === 'document' && <div className="cv-file-thumb cv-file-doc-thumb"><FileText size={18} color="var(--primary)" /></div>}
            <span className="cv-file-name">{selectedFile.file.name}</span>
          </div>
          <button className="cv-file-remove" onClick={() => setSelectedFile(null)}><X size={15} /></button>
        </div>
      )}

      {editingMsg && (
        <div className="cv-reply-preview" onClick={e => e.stopPropagation()}>
          <div className="cv-reply-preview-bar" />
          <div className="cv-reply-preview-content">
            <span className="cv-reply-preview-who"><Pencil size={12} style={{ verticalAlign: -1, marginRight: 4 }} />Edit pesan</span>
            <span className="cv-reply-preview-text">{editingMsg.body}</span>
          </div>
          <button className="cv-reply-preview-x" onClick={cancelEdit}><X size={16} /></button>
        </div>
      )}
      {replyTo && !editingMsg && (
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
              {[
                { key: 'file', icon: Paperclip, label: 'Lampirkan file', sub: 'Foto, video, dokumen', tone: 'blue', run: () => fileInputRef.current?.click() },
                { key: 'tpl', icon: Zap, label: 'Template pesan', sub: 'Ketik / untuk mencari', tone: 'amber', run: () => setShowTemplateMenu(true) },
                { key: 'media', icon: Package, label: 'Produk / katalog', sub: 'Kirim dari galeri', tone: 'green', run: () => setShowMediaGallery(true) },
                { key: 'loc', icon: MapPin, label: 'Kirim lokasi', tone: 'red', run: () => setShareModal('location') },
                { key: 'contact', icon: User, label: 'Kirim kontak', tone: 'cyan', run: () => setShareModal('contact') },
                { key: 'ai', icon: Sparkles, label: 'Saran balasan AI', tone: 'violet', run: () => handleRequestAiSuggestion() },
              ].map(it => (
                <button key={it.key} className="cv-mi cv-more-item" onClick={() => { setShowMoreMenu(false); it.run() }}>
                  <span className={`cv-more-ico ${it.tone}`}><it.icon size={16} /></span>
                  <span className="cv-more-text">
                    <span className="cv-more-label">{it.label}</span>
                    {it.sub && <span className="cv-mi-sub">{it.sub}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cv-dd cv-shared-menu-anchor">
          {showTemplateMenu && (
            <div className="cv-menu cv-template-menu">
              <div className="cv-menu-head">
                <span><Zap size={13} /> Template pesan</span>
                {slashQuery ? <span className="cv-menu-hint">filter: "{slashQuery}"</span> : <span className="cv-menu-hint">ketik / untuk mencari</span>}
              </div>
              {filteredTemplates.length === 0 ? (
                <div className="cv-mi muted">Tidak ada template cocok</div>
              ) : filteredTemplates.map(t => (
                <button key={t.id} className="cv-mi" onClick={() => insertTemplate(t)}>
                  <span className="cv-mi-title">
                    <span className="cv-mi-title-text">{t.title}</span>
                    {t.shortcut && <span className="cv-mi-sub">/{t.shortcut}</span>}
                  </span>
                  <span className="cv-tpl-preview">{t.body}</span>
                </button>
              ))}
            </div>
          )}
          {showMediaGallery && (
            <div className="cv-menu cv-media-menu">
              <div className="cv-menu-head"><span><Package size={13} /> Produk / katalog</span><span className="cv-menu-hint">klik untuk kirim</span></div>
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
                        : isPdf(m.mimetype, m.media_url)
                          ? <div className="cv-media-grid-doc"><PdfThumb url={m.media_url} /></div>
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
            <div className="cv-menu cv-ai-menu">
              <div className="cv-menu-head"><span><Sparkles size={13} /> Saran balasan AI</span></div>
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
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
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
            <span>Detail Chat</span>
            <button className="cv-notes-sidebar-close" onClick={handleToggleNotesPanel} title="Tutup"><X size={16} /></button>
          </div>

          <div className="cv-notes-body">
            {/* Kontak */}
            <section className="cv-ns cv-ns-contact">
              <div className="cv-nc-top">
                <div className="cv-avatar cv-nc-avatar" style={avatarStyle(name)}>{name[0].toUpperCase()}</div>
                <div className="cv-nc-id">
                  <div className="cv-notes-contact-name">{name}</div>
                  {phone && <div className="cv-notes-contact-phone">{phone}</div>}
                </div>
                {isAdmin && (
                  <button className="cv-contact-edit-btn" title="Edit kontak" onClick={openEditContact}>
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              <div className="cv-nc-meta">
                <span className="cv-notes-contact-label">Agent</span>
                <div>
                  {assignedAgent
                    ? <span className={`cv-assigned${isAiChat ? ' ai' : ''}`}>{isAiChat ? <Sparkles size={10} /> : <UserCheck size={10} />}{assignedAgent.name}{isAiChat ? ' · AI' : ''}</span>
                    : <span className="cv-unassigned">Unassigned</span>}
                </div>
                <span className="cv-notes-contact-label" title="Rata-rata waktu agent membalas pesan customer di chat ini">Respons</span>
                <div className="cv-resp-cell">
                  {!respStats ? <span className="cv-notes-empty-inline">—</span>
                    : respStats.avg == null ? <span className="cv-notes-empty-inline">Belum ada balasan</span>
                    : (
                      <span
                        className={`cv-resp${respStats.avg > respStats.kpiMinutes ? ' slow' : ''}`}
                        title={`Rata-rata ${formatDurLong(respStats.avg)} dari ${respStats.replies} balasan${respStats.workHours ? ' (jam kerja)' : ''} · ${respStats.met} balasan ≤${respStats.kpiMinutes} menit`}
                      >{formatDurShort(respStats.avg)}</span>
                    )}
                  {respStats?.waiting && <span className="cv-resp-wait">menunggu balasan</span>}
                </div>
                <span className="cv-notes-contact-label">Label</span>
                <div className="cv-notes-contact-tags">
                  {conversationTags.length === 0
                    ? <span className="cv-notes-empty-inline">Belum ada label</span>
                    : conversationTags.map(t => (
                      <span key={t.id} className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                    ))}
                  <button className="cv-tag-edit-btn" title="Atur label" onClick={() => setShowTagModal(true)}>
                    <TagIcon size={12} />
                  </button>
                </div>
              </div>
            </section>

            {/* Follow-up */}
            <FollowupPanel
              data={fuData}
              conversationId={id}
              contactName={conversation?.contact?.name}
              onInsertText={(t) => {
                setText(t)
                // Mobile: panel menutupi layar -> tutup agar draf terlihat di kolom ketik
                if (window.matchMedia('(max-width: 768px)').matches) setShowNotesPanel(false)
              }}
              onChanged={loadFollowup}
            />

            {/* Ingatan AI: tampil untuk chat milik AI atau bila sudah ada ingatan */}
            {(isAiChat || aiMemory?.summary) && (
              <section className="cv-ns">
                <div className="cv-ns-head">
                  <span className="cv-ns-title"><Brain size={13} />Ingatan AI</span>
                  {isAdmin && !memEditing && (
                    <button className="cv-mem-edit" onClick={() => { setMemDraft(aiMemory?.summary || ''); setMemEditing(true) }}><Pencil size={12} />Ubah</button>
                  )}
                </div>
                {memEditing ? (
                  <div className="cv-mem-form">
                    <textarea rows={6} value={memDraft} onChange={e => setMemDraft(e.target.value)} placeholder="- Nama, lokasi, tagihan listrik, kebutuhan, keberatan…" />
                    <div className="cv-mem-actions">
                      <button onClick={() => setMemEditing(false)}>Batal</button>
                      <button className="primary" onClick={saveMemory} disabled={memBusy}>{memBusy ? 'Menyimpan…' : 'Simpan'}</button>
                    </div>
                  </div>
                ) : aiMemory?.summary ? (
                  <div className="cv-mem-text">{aiMemory.summary}</div>
                ) : (
                  <div className="cv-notes-empty">Belum ada. AI meringkas fakta penting customer otomatis setelah percakapan sepi ±30 menit.</div>
                )}
              </section>
            )}

            {teamReqs.length > 0 && (
              <section className="cv-ns">
                <div className="cv-ns-head"><span className="cv-ns-title"><Users size={13} />Tanya Tim</span></div>
                <div className="cv-team">
                  {teamReqs.map(r => {
                    const [label, tone] = teamStatus(r.status)
                    const team = (r.thread || []).filter(t => t.from === 'team')
                    return (
                      <div key={r.id} className="cv-team-item">
                        <div className="cv-team-top">
                          <span className={`cv-team-div ${r.division}`}>{r.division === 'teknis' ? 'Teknis' : r.division === 'procurement' ? 'Procurement' : 'Gudang'}</span>
                          <span className={`cv-team-st ${tone}`}>{label}</span>
                        </div>
                        <div className="cv-team-topic">{r.topic || r.customer_question}</div>
                        {team.length > 0 && <div className="cv-team-ans">{team[team.length - 1].pic ? <b>{team[team.length - 1].pic}: </b> : null}{team[team.length - 1].text}</div>}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Catatan */}
            <section className="cv-ns">
              <div className="cv-ns-head">
                <span className="cv-ns-title"><StickyNote size={13} />Catatan</span>
                {notes.length > 0 && <span className="cv-ns-count">{notes.length}</span>}
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
                  <button className="cv-note-save" onClick={handleSaveNote} disabled={!noteText.trim() || savingNote}>
                    {savingNote ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            </section>

            {/* Riwayat percakapan */}
            <section className="cv-ns">
              <div className="cv-ns-head">
                <span className="cv-ns-title"><Clock size={13} />Riwayat Percakapan</span>
                {convHistory.length > 0 && <span className="cv-ns-count">{convHistory.length}</span>}
              </div>
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
            </section>

            {isAdmin && (
              <section className="cv-ns cv-danger-zone">
                <button className="cv-delete-chat" onClick={() => { setDeleteChatError(''); setShowDeleteChat(true) }}>
                  <Trash2 size={14} />Hapus chat
                </button>
                <div className="cv-notes-empty">Menghapus seluruh pesan & file media chat ini dari dashboard.</div>
              </section>
            )}
          </div>
        </div>
      )}

      {showDeleteChat && (
        <Modal title="Hapus chat?" onClose={() => !deletingChat && setShowDeleteChat(false)}>
          <div className="cv-del-body">
            <p>Semua pesan dan file media di chat dengan <b>{name}</b> akan dihapus <b>permanen</b> dari dashboard, termasuk label, follow-up, dan riwayat Tanya Tim chat ini. Tindakan ini tidak bisa dibatalkan.</p>
            <ul>
              <li>Kontak, catatan kontak, dan Ingatan AI tetap tersimpan.</li>
              <li>Chat di WhatsApp (HP & customer) tidak ikut terhapus.</li>
              <li>Bila customer mengirim pesan lagi, chat baru akan muncul.</li>
              <li>Data chat ini tidak lagi terhitung di Analytics.</li>
            </ul>
            {deleteChatError && <div className="cv-del-error">{deleteChatError}</div>}
            <div className="cv-del-actions">
              <button className="cv-del-cancel" onClick={() => setShowDeleteChat(false)} disabled={deletingChat}>Batal</button>
              <button className="cv-del-confirm" onClick={handleDeleteChat} disabled={deletingChat}><Trash2 size={14} />{deletingChat ? 'Menghapus…' : 'Hapus chat'}</button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .cv-danger-zone { display: flex; flex-direction: column; gap: 6px; }
        .cv-delete-chat { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--danger); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.3); }
        .cv-delete-chat:hover { background: rgba(229,62,62,0.14); }
        .cv-del-body { display: flex; flex-direction: column; gap: 10px; padding: 4px 20px 20px; font-size: 13.5px; color: var(--text2); line-height: 1.5; }
        .cv-del-body b { color: var(--text); }
        .cv-del-body ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: var(--muted); }
        .cv-del-error { padding: 8px 12px; border-radius: 9px; background: rgba(229,62,62,0.1); color: var(--danger); font-size: 13px; }
        .cv-del-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .cv-del-actions button { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; }
        .cv-del-cancel { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .cv-del-confirm { background: var(--danger); color: #fff; }
        .cv-del-actions button:disabled { opacity: 0.6; }
        .cv-root { flex: 1; display: flex; flex-direction: row; min-height: 0; min-width: 0; background: var(--bg); overflow: hidden; }
        .cv-chat-col { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
        .cv-header { display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 20px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; min-height: 64px; }
        .cv-back { display: none; width: 36px; height: 36px; border-radius: 8px; align-items: center; justify-content: center; color: var(--muted); flex-shrink: 0; }
        .cv-back:hover { background: var(--surface3); }
        @media (max-width: 768px) { .cv-back { display: flex; } }
        .cv-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex-shrink: 0; }
        .cv-contact { flex: 1; min-width: 0; overflow: hidden; cursor: pointer; border-radius: 8px; padding: 2px 6px; margin: -2px -6px; transition: background 0.15s; }
        .cv-contact:hover { background: var(--surface3); }
        .cv-name { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-sub { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 3px; }
        .cv-resp-cell { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .cv-resp { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--success); background: rgba(16,185,129,0.12); font-variant-numeric: tabular-nums; }
        .cv-resp.slow { color: #d97706; background: rgba(217,119,6,0.13); }
        .cv-resp-wait { font-size: 11px; font-weight: 600; color: #d97706; }
        .cv-assigned.ai { background: rgba(124,58,237,0.13); color: #8b5cf6; }
        .cv-assigned { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: rgba(39,168,122,0.1); color: var(--success); }
        .cv-region-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; white-space: nowrap; }
        .cv-region-badge.barat { color: #2563eb; background: rgba(37,99,235,0.12); }
        .cv-region-badge.timur { color: #d97706; background: rgba(217,119,6,0.12); }
        .cv-region-badge.bot { color: var(--primary); background: var(--primary-light); }
        .cv-region-badge.unknown { color: var(--warning, #d08b28); background: rgba(208,139,40,0.12); border: 1px dashed rgba(208,139,40,0.5); }
        .cv-region-pick { display: flex; gap: 6px; padding: 4px 10px 10px; }
        .cv-region-opt { flex: 1; padding: 6px 0; border-radius: 8px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--border); background: var(--surface2); color: var(--text2); transition: all 0.15s; }
        .cv-region-opt.barat.active, .cv-region-opt.barat:hover { color: #2563eb; border-color: rgba(37,99,235,0.5); background: rgba(37,99,235,0.1); }
        .cv-region-opt.timur.active, .cv-region-opt.timur:hover { color: #d97706; border-color: rgba(217,119,6,0.5); background: rgba(217,119,6,0.1); }
        .cv-region-opt:disabled { opacity: 0.6; cursor: not-allowed; }
        .cv-unassigned { font-size: 11px; padding: 1px 7px; border-radius: 10px; background: rgba(208,139,40,0.1); color: var(--warning); }
        .cv-status-badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px; }
        .cv-status-badge.st-open { background: rgba(208,139,40,0.12); color: var(--warning); }
        .cv-status-badge.st-in_progress { background: var(--primary-light); color: var(--primary); }
        .cv-status-badge.st-resolved { background: rgba(39,168,122,0.12); color: var(--success); }
        .cv-actions { position: relative; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .cv-dd { position: relative; }
        .cv-header-menu { position: fixed !important; top: 66px !important; right: 16px !important; left: auto !important; min-width: 260px !important; }
        .cv-hdr-btn { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border); transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .cv-hdr-btn:hover { background: var(--surface2); border-color: var(--border2); }
        .cv-hdr-btn.active { background: var(--primary-light); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, transparent); }
        .cv-menu { position: absolute; right: 0; top: calc(100% + 6px); max-width: calc(100vw - 24px); box-sizing: border-box; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; z-index: 200; box-shadow: 0 12px 32px var(--shadow), 0 2px 6px var(--shadow); overflow: hidden; }
        .cv-menu-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px 6px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .cv-menu-head > span:first-child { display: inline-flex; align-items: center; gap: 6px; }
        .cv-menu-hint { font-size: 11px; font-weight: 500; text-transform: none; letter-spacing: 0; }
        .cv-notes-btn { position: relative; }
        .cv-fu-dot { position: absolute; top: -4px; right: -4px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--surface); }
        .cv-fu-dot.today { background: #d97706; } .cv-fu-dot.late { background: var(--danger, #e53e3e); }
        .cv-menu-lbl { padding: 8px 10px 4px; font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .cv-mi { display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px; font-size: 13px; color: var(--text); transition: background 0.1s; }
        .cv-mi:hover { background: var(--surface3); }
        .cv-mi.muted { color: var(--muted); cursor: default; }
        .cv-mi-unassign { color: var(--danger); margin-top: 2px; }
        .cv-mi-unassign:hover { background: rgba(229,62,62,0.06); }
        .cv-mi.active { background: var(--primary-light); }
        .cv-mi-agent { flex-direction: row; align-items: center; gap: 10px; }
        .cv-mi-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .cv-mi-agent-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cv-mi-agent-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
        .cv-mi-check { color: var(--primary); flex-shrink: 0; }
        .cv-more-item { flex-direction: row; align-items: center; gap: 11px; padding: 7px 8px; }
        .cv-more-ico { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cv-more-ico.blue { background: rgba(37,99,235,0.13); color: #3b82f6; }
        .cv-more-ico.amber { background: rgba(217,119,6,0.14); color: #d97706; }
        .cv-more-ico.green { background: rgba(22,163,74,0.14); color: #16a34a; }
        .cv-more-ico.red { background: rgba(220,38,38,0.12); color: #ef4444; }
        .cv-more-ico.cyan { background: rgba(8,145,178,0.14); color: #0891b2; }
        .cv-more-ico.violet { background: rgba(124,92,214,0.14); color: #8b5cf6; }
        .cv-more-text { display: flex; flex-direction: column; min-width: 0; }
        .cv-more-label { font-size: 13.5px; font-weight: 500; color: var(--text); }
        .cv-mi-title { display: flex; align-items: baseline; justify-content: flex-start; gap: 6px; width: 100%; text-align: left; }
        .cv-mi-title-text { text-align: left; }
        .cv-mi-sub { font-size: 11px; color: var(--muted); margin-top: 1px; text-align: left; }
        .cv-error { background: rgba(229,62,62,0.05); border-bottom: 1px solid rgba(229,62,62,0.12); color: var(--danger); padding: 8px 16px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .cv-messages-wrap { position: relative; flex: 1; min-height: 0; display: flex; }
        .cv-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 2px; background-color: var(--bg); background-image: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22300%22%20viewBox%3D%220%200%20300%20300%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%231a2540%22%20stroke-opacity%3D%220.05%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2246%22%20cy%3D%2246%22%20r%3D%2212%22%2F%3E%3Cpath%20d%3D%22M46%2022v-6M46%2076v-6M22%2046h-6M76%2046h6M30%2030l-5-5M62%2062l5%205M62%2030l5-5M30%2062l-5%205%22%2F%3E%3Cg%20transform%3D%22rotate(-12%20214%2052)%22%3E%3Crect%20x%3D%22184%22%20y%3D%2234%22%20width%3D%2260%22%20height%3D%2238%22%20rx%3D%222%22%2F%3E%3Cpath%20d%3D%22M184%2047h60M184%2060h60M204%2034v38M224%2034v38%22%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%22M214%2074v12M202%2092h24%22%2F%3E%3Cpath%20d%3D%22M54%20128l-15%2024h10l-8%2022%2024-30H63l9-16z%22%2F%3E%3Crect%20x%3D%22126%22%20y%3D%22140%22%20width%3D%2244%22%20height%3D%2224%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M170%20147v10%22%2F%3E%3Cpath%20d%3D%22M135%20152h8M139%20148v8%22%2F%3E%3Cpath%20d%3D%22M28%20246l26-20%2026%2020M38%20240v20h32v-20%22%2F%3E%3Cpath%20d%3D%22M48%20232l12-9%207%205-12%209z%22%2F%3E%3Cpath%20d%3D%22M206%20214v-12M222%20214v-12M200%20214h28v5a14%2014%200%200%201-28%200z%22%2F%3E%3Cpath%20d%3D%22M214%20233v9%22%2F%3E%3Ccircle%20cx%3D%22150%22%20cy%3D%22244%22%20r%3D%227%22%2F%3E%3Cpath%20d%3D%22M150%20231v-4M150%20261v-4M137%20244h-4M167%20244h-4%22%2F%3E%3Cpath%20d%3D%22M100%20100q13-14%2026%200t26%200%22%2F%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22150%22%20r%3D%223%22%20fill%3D%22%231a2540%22%20fill-opacity%3D%220.05%22%20stroke%3D%22none%22%2F%3E%3Crect%20x%3D%22250%22%20y%3D%22238%22%20width%3D%2230%22%20height%3D%2220%22%20rx%3D%222%22%2F%3E%3Cpath%20d%3D%22M250%20248h30M265%20238v20%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"); }
        @media (prefers-color-scheme: dark) {
          .cv-messages { background-image: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22300%22%20viewBox%3D%220%200%20300%20300%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23e8edf6%22%20stroke-opacity%3D%220.05%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2246%22%20cy%3D%2246%22%20r%3D%2212%22%2F%3E%3Cpath%20d%3D%22M46%2022v-6M46%2076v-6M22%2046h-6M76%2046h6M30%2030l-5-5M62%2062l5%205M62%2030l5-5M30%2062l-5%205%22%2F%3E%3Cg%20transform%3D%22rotate(-12%20214%2052)%22%3E%3Crect%20x%3D%22184%22%20y%3D%2234%22%20width%3D%2260%22%20height%3D%2238%22%20rx%3D%222%22%2F%3E%3Cpath%20d%3D%22M184%2047h60M184%2060h60M204%2034v38M224%2034v38%22%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%22M214%2074v12M202%2092h24%22%2F%3E%3Cpath%20d%3D%22M54%20128l-15%2024h10l-8%2022%2024-30H63l9-16z%22%2F%3E%3Crect%20x%3D%22126%22%20y%3D%22140%22%20width%3D%2244%22%20height%3D%2224%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M170%20147v10%22%2F%3E%3Cpath%20d%3D%22M135%20152h8M139%20148v8%22%2F%3E%3Cpath%20d%3D%22M28%20246l26-20%2026%2020M38%20240v20h32v-20%22%2F%3E%3Cpath%20d%3D%22M48%20232l12-9%207%205-12%209z%22%2F%3E%3Cpath%20d%3D%22M206%20214v-12M222%20214v-12M200%20214h28v5a14%2014%200%200%201-28%200z%22%2F%3E%3Cpath%20d%3D%22M214%20233v9%22%2F%3E%3Ccircle%20cx%3D%22150%22%20cy%3D%22244%22%20r%3D%227%22%2F%3E%3Cpath%20d%3D%22M150%20231v-4M150%20261v-4M137%20244h-4M167%20244h-4%22%2F%3E%3Cpath%20d%3D%22M100%20100q13-14%2026%200t26%200%22%2F%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22150%22%20r%3D%223%22%20fill%3D%22%23e8edf6%22%20fill-opacity%3D%220.05%22%20stroke%3D%22none%22%2F%3E%3Crect%20x%3D%22250%22%20y%3D%22238%22%20width%3D%2230%22%20height%3D%2220%22%20rx%3D%222%22%2F%3E%3Cpath%20d%3D%22M250%20248h30M265%20238v20%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"); }
        }
        /* Default rata atas (pesan menempel di bawah kartu). Saat keyboard terbuka
           (.kb-open) spacer dorong pesan ke bawah dekat input. Saat pesan memenuhi
           layar, margin auto tetap 0 sehingga scroll normal di kedua kondisi. */
        .cv-msg-spacer { margin-top: 0; }
        .cv-messages.kb-open .cv-msg-spacer { margin-top: auto; }
        .cv-load-older { display: flex; justify-content: center; padding: 8px 0 4px; }
        /* Kartu info kontak di awal percakapan (seperti WhatsApp) */
        .cv-contact-card { align-self: center; max-width: 380px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px 20px; margin-bottom: 10px; box-shadow: 0 1px 3px var(--shadow); }
        .cv-cc-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 700; margin-bottom: 4px; }
        .cv-cc-name { font-size: 17px; font-weight: 700; color: var(--text); }
        .cv-cc-phone { font-size: 14px; color: var(--text2); }
        .cv-cc-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 8px; }
        .cv-cc-agent { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--success); background: var(--surface3); padding: 3px 9px; border-radius: 20px; }
        .cv-scroll-bottom-btn { position: absolute; right: 20px; bottom: 16px; width: 38px; height: 38px; border-radius: 50%; background: var(--surface); color: var(--text2); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px var(--shadow); border: 1px solid var(--border); z-index: 50; transition: all 0.15s; animation: popIn 0.18s ease-out; }
        .cv-scroll-bottom-btn:hover { background: var(--surface2); color: var(--primary); }
        .cv-loading { display: flex; flex-direction: column; gap: 8px; }
        .cv-skel { height: 40px; max-width: 55%; border-radius: 10px; background: var(--skeleton); animation: pulse 1.4s ease infinite; }
        .cv-skel.left { align-self: flex-start; }
        .cv-skel.right { align-self: flex-end; }
        .cv-empty { margin: auto; color: var(--muted); font-size: 14px; text-align: center; padding: 32px; }
        .cv-day { display: flex; flex-direction: column; gap: 2px; }
        .cv-date-sep { position: sticky; top: 2px; z-index: 5; display: flex; align-items: center; justify-content: center; margin: 12px 0 6px; pointer-events: none; }
        .cv-date-sep span { background: var(--surface); color: var(--text2); border: 1px solid var(--border); box-shadow: 0 1px 3px var(--shadow); font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
        .cv-row { display: flex; align-items: center; gap: 6px; position: relative; touch-action: pan-y; }
        .cv-row.grp-start { margin-top: 8px; }
        .cv-row.sent { justify-content: flex-end; }
        .cv-row.recv { justify-content: flex-start; }
        /* Tombol aksi saat hover — hanya untuk perangkat desktop (punya hover & pointer presisi) */
        .cv-hover-actions { display: none; align-items: center; gap: 2px; opacity: 0; transition: opacity 0.12s; order: 0; }
        .cv-row.sent .cv-hover-actions { order: -1; }
        .cv-row.recv .cv-hover-actions { order: 2; }
        .cv-hover-btn { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--muted); background: transparent; }
        .cv-hover-btn:hover { background: var(--surface3); color: var(--primary); }
        .cv-hover-btn.danger:hover { background: #fde8e8; color: var(--danger); }
        @media (hover: hover) and (pointer: fine) {
          .cv-hover-actions { display: flex; }
          .cv-row:hover .cv-hover-actions { opacity: 1; }
        }
        /* Perangkat sentuh: matikan seleksi teks & callout agar long-press = menu aksi */
        @media (pointer: coarse) {
          .cv-bubble { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        }
        /* Action sheet (long-press mobile) */
        .cv-sheet-overlay { position: fixed; inset: 0; z-index: 600; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.15s ease; }
        .cv-sheet { width: 100%; max-width: 460px; background: var(--surface); border-radius: 16px 16px 0 0; padding: 8px; display: flex; flex-direction: column; gap: 2px; animation: sheetUp 0.2s ease-out; padding-bottom: max(8px, env(safe-area-inset-bottom)); }
        .cv-sheet-preview { font-size: 12px; color: var(--muted); padding: 10px 14px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
        .cv-sheet-item { display: flex; align-items: center; gap: 14px; padding: 14px 16px; font-size: 15px; color: var(--text); border-radius: 10px; text-align: left; }
        .cv-sheet-item:active { background: var(--surface3); }
        .cv-sheet-item.danger { color: var(--danger); }
        .cv-sheet-cancel { margin-top: 4px; padding: 13px; font-size: 15px; font-weight: 600; color: var(--text2); background: var(--surface3); border-radius: 10px; }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        /* Toast kecil (mis. pesan disalin) */
        .cv-toast { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 700; display: flex; align-items: center; gap: 7px; background: rgba(26,37,64,0.94); color: var(--on-primary); font-size: 13px; font-weight: 500; padding: 9px 16px; border-radius: 999px; box-shadow: 0 6px 20px var(--shadow); animation: cvToastIn 0.18s ease-out; }
        @keyframes cvToastIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        /* Forward modal */
        .cv-forward { display: flex; flex-direction: column; padding: 14px 16px 16px; gap: 10px; }
        .cv-forward-preview { background: var(--surface3); border-left: 3px solid var(--primary); border-radius: 6px; padding: 7px 10px; font-size: 13px; color: var(--text2); display: flex; flex-direction: column; gap: 2px; }
        .cv-forward-media { font-size: 11px; font-weight: 700; color: var(--primary); display: inline-flex; align-items: center; gap: 4px; text-transform: capitalize; }
        .cv-forward-preview-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-forward-search { display: flex; align-items: center; gap: 8px; height: 40px; border: 1px solid var(--border); border-radius: 9px; padding: 0 12px; color: var(--muted); background: var(--surface2); }
        .cv-forward-search:focus-within { border-color: var(--primary); }
        .cv-forward-search input { flex: 1; border: none; outline: none; font-size: 14px; color: var(--text); background: transparent; }
        .cv-forward-list { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
        .cv-forward-empty { text-align: center; color: var(--muted); font-size: 13px; padding: 20px 0; }
        .cv-forward-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; padding: 28px 0; }
        .cv-forward-spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid var(--border); border-top-color: var(--primary); animation: cvspin 0.7s linear infinite; }
        @keyframes cvspin { to { transform: rotate(360deg); } }
        .cv-forward-item { display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-radius: 8px; text-align: left; transition: background 0.12s; }
        .cv-forward-item:hover:not(:disabled) { background: var(--surface3); }
        .cv-forward-item:disabled { opacity: 0.6; }
        .cv-forward-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cv-forward-name { flex: 1; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-forward-ico { color: var(--muted); flex-shrink: 0; }
        .cv-forward-check { color: var(--success); flex-shrink: 0; }
        .cv-swipe-cue { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--surface3); color: var(--muted); transition: background 0.12s, color 0.12s; }
        .cv-swipe-cue.left { left: 4px; }
        .cv-swipe-cue.right { right: 4px; }
        .cv-swipe-cue.active { background: var(--primary); color: var(--on-primary); }
        .cv-quote { display: flex; flex-direction: column; gap: 1px; border-left: 3px solid; padding: 4px 8px; margin-bottom: 5px; border-radius: 5px; max-width: 100%; overflow: hidden; }
        .cv-quote.clickable { cursor: pointer; }
        /* Sorot pesan tujuan saat diklik dari kutipan */
        .cv-row.flash .cv-bubble { animation: cvFlash 1.4s ease; }
        @keyframes cvFlash { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 25% { box-shadow: 0 0 0 3px var(--primary); } }
        .cv-quote.on-sent { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.14); }
        .cv-quote.on-recv { border-color: var(--primary); background: var(--surface3); }
        .cv-quote-who { font-size: 11px; font-weight: 700; }
        .cv-quote.on-sent .cv-quote-who { color: rgba(255,255,255,0.95); }
        .cv-quote.on-recv .cv-quote-who { color: var(--primary); }
        .cv-quote-text { font-size: 12px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
        .cv-quote.on-sent .cv-quote-text { color: rgba(255,255,255,0.85); }
        .cv-quote.on-recv .cv-quote-text { color: var(--text2); }
        .cv-reply-preview { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--surface3); border-top: 1px solid var(--border2); }
        .cv-reply-preview-bar { width: 3px; align-self: stretch; background: var(--primary); border-radius: 2px; flex-shrink: 0; }
        .cv-reply-preview-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .cv-reply-preview-who { font-size: 12px; font-weight: 700; color: var(--primary); }
        .cv-reply-preview-text { font-size: 12px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-reply-preview-x { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); flex-shrink: 0; }
        .cv-reply-preview-x:hover { background: var(--surface3); color: var(--primary); }
        .cv-bubble { max-width: min(62%, 560px); padding: 8px 12px 6px; border-radius: 14px; box-shadow: 0 1px 2px var(--shadow); word-break: break-word; }
        .cv-bubble.media { padding: 4px 4px 7px; }
        .cv-bubble.sending { opacity: 0.65; }
        .bsent { background: var(--sent); color: var(--sent-text); }
        .brecv { background: var(--recv); color: var(--recv-text); border: 1px solid var(--border); }
        /* "Ekor" bubble hanya di pesan pertama tiap kelompok */
        .cv-row.grp-start .bsent { border-top-right-radius: 4px; }
        .cv-row.grp-start .brecv { border-top-left-radius: 4px; }
        .cv-bubble p { font-size: 14.2px; line-height: 1.5; white-space: pre-wrap; }
        .cv-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 3px; padding: 0 2px; }
        .cv-bot-tag.ai { background: rgba(139,92,246,0.28); }
        .brecv .cv-bot-tag.ai { background: rgba(139,92,246,0.14); color: #8b5cf6; }
        .cv-hover-btn.ai:hover { color: #8b5cf6; }
        .cv-team { display: flex; flex-direction: column; gap: 8px; }
        .cv-team-item { display: flex; flex-direction: column; gap: 4px; padding: 9px 11px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .cv-team-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .cv-team-div { padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700; background: rgba(139,92,246,0.12); color: #8b5cf6; }
        .cv-team-div.teknis { background: rgba(49,130,206,0.12); color: #3182ce; }
        .cv-team-div.procurement { background: rgba(214,158,46,0.14); color: #b7791f; }
        .cv-team-st { padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700; background: var(--surface3); color: var(--text2); }
        .cv-team-st.wait { background: rgba(214,158,46,0.14); color: #b7791f; }
        .cv-team-st.ask { background: rgba(49,130,206,0.12); color: #3182ce; }
        .cv-team-st.ok { background: rgba(56,161,105,0.14); color: var(--success); }
        .cv-team-st.bad { background: rgba(229,62,62,0.1); color: var(--danger); }
        .cv-team-topic { font-size: 12.5px; font-weight: 600; color: var(--text); }
        .cv-team-ans { font-size: 12px; color: var(--text2); line-height: 1.45; white-space: pre-wrap; }
        .cv-mem-edit { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--primary); }
        .cv-mem-text { font-size: 12.5px; line-height: 1.55; color: var(--text2); white-space: pre-wrap; padding: 10px 12px; border-radius: 10px; background: rgba(139,92,246,0.07); border: 1px solid rgba(139,92,246,0.2); }
        .cv-mem-form { display: flex; flex-direction: column; gap: 8px; }
        .cv-mem-form textarea { width: 100%; padding: 9px 11px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-size: 12.5px; line-height: 1.5; font-family: inherit; resize: vertical; outline: none; }
        .cv-mem-form textarea:focus { border-color: var(--primary); }
        .cv-mem-actions { display: flex; justify-content: flex-end; gap: 6px; }
        .cv-mem-actions button { height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .cv-mem-actions button.primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }
        .cv-bot-tag { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 700; padding: 0 5px; border-radius: 6px; background: rgba(255,255,255,0.18); margin-right: 2px; }
        .brecv .cv-bot-tag { background: var(--surface3); color: var(--text2); }
        .cv-edited { font-size: 10px; font-style: italic; opacity: 0.7; margin-right: 2px; }
        .cv-time { font-size: 10.5px; color: rgba(255,255,255,0.7); white-space: nowrap; }
        .brecv .cv-time { color: var(--muted); }
        .cv-media-wrap { min-width: 180px; }
        .cv-media-skeleton { width: 240px; height: 160px; border-radius: 8px; background: var(--skeleton); overflow: hidden; }
        .cv-media-skel-inner { width: 100%; height: 100%; background: linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.4) 50%,transparent 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        .cv-media-img { width: 100%; max-width: 280px; border-radius: 8px; display: block; cursor: zoom-in; object-fit: cover; }
        .cv-media-video { width: 100%; max-width: 280px; border-radius: 8px; display: block; }
        .cv-media-audio-wrap { padding: 4px 0; }
        .cv-media-audio { width: 220px; height: 36px; }
        .cv-media-caption { font-size: 13px; padding: 6px 4px 0; line-height: 1.4; }
        .cv-media-broken { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; text-decoration: none; min-width: 180px; }
        .cv-media-broken.sent { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cv-media-broken.recv { background: var(--surface3); color: var(--text2); border: 1px solid var(--border); }
        .cv-media-broken-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .cv-media-broken-info span { font-size: 13px; font-weight: 600; }
        .cv-media-broken-sub { font-size: 11px; opacity: 0.65; font-weight: 400 !important; }
        .cv-sticker-wrap { display: flex; flex-direction: column; gap: 4px; }
        .cv-sticker { width: 130px; height: 130px; object-fit: contain; }
        .cv-special-link { text-decoration: none; }
        .cv-special-card { display: flex; align-items: flex-start; gap: 11px; padding: 10px 12px; border-radius: 10px; min-width: 230px; max-width: 320px; }
        .cv-special-card.sent { background: rgba(255,255,255,0.15); color: var(--on-primary); }
        .cv-special-card.recv { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
        .cv-special-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cv-special-icon.loc { background: rgba(220,38,38,0.13); color: #ef4444; }
        .cv-special-icon.contact { background: rgba(37,99,235,0.13); color: #3b82f6; }
        .cv-special-card.sent .cv-special-icon { background: rgba(255,255,255,0.2); color: var(--on-primary); }
        .cv-special-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .cv-special-title { font-size: 14px; font-weight: 700; line-height: 1.3; }
        .cv-special-detail { font-size: 12px; opacity: 0.8; line-height: 1.35; }
        .cv-special-action { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 11.5px; font-weight: 600; color: var(--primary); }
        .cv-special-card.sent .cv-special-action { color: var(--on-primary); opacity: 0.9; }
        .cv-media-doc { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; text-decoration: none; min-width: 200px; cursor: pointer; }
        .cv-media-doc.sent { background: rgba(255,255,255,0.15); color: var(--on-primary); }
        .cv-media-doc.recv { background: var(--surface3); color: var(--text); border: 1px solid var(--border); }
        .cv-media-doc-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; position: relative; }
        .bsent .cv-media-doc-icon { background: rgba(255,255,255,0.18); color: var(--on-primary); }
        .brecv .cv-media-doc-icon { background: var(--surface3); color: var(--primary); }
        .cv-media-doc-ext { font-size: 8px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; }
        .cv-dl-ring { position: absolute; inset: 3px; border-radius: 50%; border: 2.5px solid transparent; border-top-color: currentColor; animation: spin 0.8s linear infinite; }
        .cv-dl-icon { position: relative; z-index: 1; }
        .bsent .cv-media-doc-icon.dl-done { background: rgba(39,168,122,0.25); color: #6ee7c7; }
        .brecv .cv-media-doc-icon.dl-done { background: rgba(39,168,122,0.12); color: var(--success); }
        .cv-media-doc-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        .cv-media-doc-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .cv-media-doc-sub { font-size: 11px; opacity: 0.65; }
        .cv-media-placeholder { display: flex; align-items: center; gap: 6px; font-size: 13px; opacity: 0.7; padding: 4px; }
        .cv-file-preview { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--surface3); border-top: 1px solid var(--border2); flex-shrink: 0; }
        .cv-file-preview-content { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .cv-file-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
        .cv-file-video-thumb { background: #1a2540; display: flex; align-items: center; justify-content: center; }
        .cv-file-doc-thumb { background: var(--surface3); border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; }
        .cv-file-name { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .cv-file-remove { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .cv-file-remove:hover { background: var(--surface3); color: var(--primary); }
        .cv-input-bar { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0; }
        .cv-shared-menu-anchor { position: absolute; left: 14px; bottom: 100%; width: 0; height: 0; }
        .cv-attach-btn { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; border: 1.5px solid var(--border); background: var(--surface2); }
        .cv-attach-btn:hover { background: var(--surface3); color: var(--primary); border-color: var(--border2); }
                .cv-more-dd { display: block; }
        .cv-more-menu { min-width: 250px; }
        .cv-input { flex: 1; background: var(--surface2); border: 1.5px solid var(--border); border-radius: 12px; color: var(--text); padding: 11px 14px; font-size: 14px; line-height: 22px; height: 44px; min-height: 44px; max-height: 120px; outline: none; resize: none; overflow-y: auto; transition: border-color 0.15s; font-family: inherit; }
        .cv-input:focus { border-color: var(--primary); background: var(--surface); }
        .cv-input::placeholder { color: var(--muted); }
        .cv-send-btn { display: flex; align-items: center; justify-content: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 12px; flex-shrink: 0; background: var(--surface3); color: var(--muted); font-size: 14px; font-weight: 600; transition: all 0.15s; white-space: nowrap; }
        .cv-send-btn.ready { background: var(--primary); color: var(--on-primary); box-shadow: 0 4px 12px rgba(53,99,233,0.28); }
        .cv-send-btn.ready:hover { background: var(--primary-hover); }
        .cv-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cv-sending-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; animation: spin 0.7s linear infinite; }
        .cv-lightbox { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; }
        .cv-lightbox-close { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: white; }
        .cv-lightbox-close:hover { background: rgba(255,255,255,0.25); }
        .cv-lightbox-img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
        .cv-lightbox-msg { display: flex; flex-direction: column; align-items: center; gap: 12px; color: rgba(255,255,255,0.85); font-size: 14px; padding: 40px; }
        .cv-input-bar .cv-dd .cv-menu { bottom: calc(100% + 8px); top: auto; left: 0; right: auto; max-height: 360px; overflow-y: auto; }
        .cv-template-menu { width: 360px; }
        .cv-template-menu .cv-mi { gap: 2px; }
        .cv-template-menu .cv-mi-title-text { font-weight: 600; }
        .cv-tpl-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; color: var(--muted); line-height: 1.4; }
        .cv-media-menu { width: 360px; }
        .cv-ai-menu { width: 380px; }
        .cv-media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 4px 6px 8px; }
        .cv-media-grid-item { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 0; border-radius: 10px; overflow: hidden; background: var(--surface2); border: 1px solid var(--border); transition: border-color 0.15s, transform 0.15s; }
        .cv-media-grid-item:hover { border-color: var(--primary); transform: translateY(-1px); }
        .cv-media-grid-item img { width: 100%; height: 82px; object-fit: cover; }
        .cv-media-grid-doc { width: 100%; height: 82px; display: flex; align-items: center; justify-content: center; color: var(--muted); background: var(--surface3); }
        .cv-media-grid-label { font-size: 11px; font-weight: 500; color: var(--text2); padding: 5px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
        .cv-media-grid-sending { position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; }
        .cv-sending-dot.dark { border-color: rgba(53,99,233,0.3); border-top-color: var(--primary); }
        .cv-ai-loading { flex-direction: row; align-items: center; gap: 8px; color: var(--muted); }
        .cv-ai-suggestion-box { padding: 4px 8px 8px; display: flex; flex-direction: column; gap: 10px; }
        .cv-ai-suggestion-text { font-size: 13px; color: var(--text); white-space: pre-wrap; line-height: 1.5; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; max-height: 180px; overflow-y: auto; }
        .cv-ai-suggestion-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .cv-ai-use-btn { padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; background: var(--primary); color: var(--on-primary); transition: all 0.15s; }
        .cv-ai-use-btn:hover { background: var(--primary-hover); }
        .cv-ai-close-btn { padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--text2); background: var(--surface3); }
        .cv-ai-close-btn:hover { background: var(--surface3); }
        .cv-ai-error-box { display: flex; flex-direction: column; gap: 8px; padding: 4px 10px 10px; font-size: 13px; color: var(--danger); }
        .cv-ai-retry { align-self: flex-start; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; background: rgba(229,62,62,0.08); color: var(--danger); }
        .cv-ai-retry:hover { background: rgba(229,62,62,0.14); }
        @media (max-width: 768px) {
          .cv-header { padding: 10px 12px; gap: 8px; min-height: 56px; position: sticky; top: 0; z-index: 20; }
          .cv-messages { padding: 12px; }
          .cv-bubble { max-width: 78%; }
          .cv-btn-label { display: none; }
          .cv-actions { gap: 6px; }
          .cv-hdr-btn { width: 38px; height: 38px; padding: 0; }
          /* Badge header 1 baris (geser horizontal); detail lengkap di panel Detail */
          .cv-sub { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
          .cv-sub::-webkit-scrollbar { display: none; }
          .cv-sub > * { flex-shrink: 0; }
          .cv-template-menu, .cv-media-menu, .cv-ai-menu { width: calc(100vw - 24px); }
          .cv-send-label { display: none; }
          .cv-send-btn { padding: 0; width: 44px; height: 44px; justify-content: center; border-radius: 12px; }
          .cv-input-bar { padding: 8px 10px; gap: 6px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
          /* Saat keyboard terbuka, hilangkan gap safe-area (keyboard menutupi home indicator) */
          .cv-root.kb-open .cv-input-bar { padding-bottom: 8px; }
          .cv-more-dd { display: block; }
          .cv-notes-sidebar { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; z-index: 400; border-left: none; animation: slideInRight 0.22s ease-out; }
          .cv-header-menu { top: 58px !important; right: 8px !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes popIn { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .tag-chip { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: var(--on-primary); white-space: nowrap; }
        .cv-tag-edit-btn { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); background: var(--surface3); flex-shrink: 0; }
        .cv-tag-edit-btn:hover { background: var(--surface3); color: var(--primary); }
        .cv-del-conv-btn.active { background: var(--primary-light); color: var(--primary); }

        .cv-notes-sidebar { width: 330px; flex-shrink: 0; background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; }
        .cv-notes-sidebar-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; min-height: 64px; padding: 0 14px 0 18px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 700; color: var(--text); flex-shrink: 0; }
        .cv-notes-body { padding: 0 18px 24px; display: flex; flex-direction: column; }
        /* Bagian panel (dipakai juga oleh FollowupPanel) */
        .cv-ns { padding: 16px 0; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
        .cv-ns:last-child { border-bottom: none; }
        .cv-ns-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; }
        .cv-ns-title { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; }
        .cv-ns-count { font-size: 10.5px; font-weight: 700; color: var(--text2); background: var(--surface3); padding: 1px 7px; border-radius: 999px; }
        .cv-nc-top { display: flex; align-items: center; gap: 12px; }
        .cv-nc-avatar { width: 44px; height: 44px; font-size: 17px; }
        .cv-nc-id { flex: 1; min-width: 0; }
        .cv-nc-meta { display: grid; grid-template-columns: 52px 1fr; align-items: center; gap: 10px 10px; padding: 10px 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .cv-notes-sidebar-close { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; flex-shrink: 0; }
        .cv-notes-sidebar-close:hover { background: var(--surface3); color: var(--text2); }
        .cv-notes-contact-name { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-contact-edit-btn { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: var(--surface3); color: var(--primary); flex-shrink: 0; transition: background 0.12s; }
        .cv-contact-edit-btn:hover { background: var(--surface3); }
        .cv-edit-contact { display: flex; flex-direction: column; padding: 18px 20px 20px; }
        .cv-edit-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 5px; }
        .cv-edit-input { height: 40px; border: 1px solid var(--border); border-radius: 9px; padding: 0 12px; font-size: 14px; color: var(--text); background: var(--surface2); outline: none; margin-bottom: 12px; transition: border 0.12s; }
        .cv-edit-input:focus { border-color: var(--primary); background: var(--surface); }
        .cv-edit-hint { font-size: 11px; color: var(--muted); margin: -6px 0 12px; line-height: 1.4; }
        .cv-edit-error { font-size: 12px; color: var(--danger); margin-bottom: 10px; }
        .cv-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .cv-edit-cancel { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text2); background: var(--surface3); }
        .cv-edit-cancel:disabled { opacity: 0.5; }
        .cv-edit-save { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--on-primary); background: var(--primary); }
        .cv-edit-save:disabled { opacity: 0.5; }
        .cv-notes-contact-phone { font-size: 12.5px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-notes-contact-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
        .cv-notes-contact-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cv-nc-meta .tag-chip { font-size: 11px; padding: 2px 9px; }
        .cv-nc-meta .cv-tag-edit-btn { width: 22px; height: 22px; }
        .cv-notes-empty-inline { font-size: 12px; color: var(--muted); }
        .cv-notes-list { display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; }
        .cv-notes-list:empty { display: none; }
        .cv-notes-loading, .cv-notes-empty { font-size: 12.5px; color: var(--muted); }
        .cv-note-item { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
        .cv-note-body { font-size: 13px; color: var(--text); white-space: pre-wrap; margin-bottom: 4px; }
        .cv-note-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); }
        .cv-notes-form { display: flex; flex-direction: column; gap: 8px; }
        .cv-notes-form textarea { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 9px 11px; font-size: 13px; line-height: 1.45; outline: none; resize: vertical; min-height: 64px; font-family: inherit; }
        .cv-notes-form textarea:focus { border-color: var(--primary); }
        .cv-notes-form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .cv-note-save { padding: 7px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--primary); color: var(--on-primary); transition: all 0.15s; }
        .cv-note-save:hover { background: var(--primary-hover); }
        .cv-note-save:disabled { background: var(--surface3); color: var(--muted); cursor: not-allowed; }
        .cv-history-list { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
        .cv-history-item { display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; transition: all 0.15s; }
        .cv-history-item:hover { background: var(--surface3); border-color: var(--border2); }
        .cv-history-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .cv-history-badge { font-size: 10px; font-weight: 600; padding: 1px 8px; border-radius: 10px; }
        .cv-history-badge.st-open { background: var(--primary-light); color: var(--primary); }
        .cv-history-badge.st-in_progress { background: rgba(208,139,40,0.1); color: var(--warning); }
        .cv-history-badge.st-resolved { background: rgba(39,168,122,0.1); color: var(--success); }
        .cv-history-time { font-size: 11px; color: var(--muted); flex-shrink: 0; }
        .cv-history-preview { font-size: 12px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cv-modal-overlay { position: fixed; inset: 0; z-index: 500; background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .cv-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; max-height: 90vh; overflow-y: auto; animation: cvModalIn 0.16s ease-out; }
        @keyframes cvModalIn { from { opacity: 0; transform: translateY(6px) scale(0.99); } to { opacity: 1; transform: none; } }
        .cv-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
        .cv-modal-header h3 { font-size: 15px; font-weight: 700; color: var(--text); }
        .cv-modal-close { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .cv-modal-close:hover { background: var(--surface3); color: var(--text2); }
        .cv-tag-modal-list { padding: 12px 12px 14px; display: flex; flex-direction: column; gap: 2px; }
        .cv-tag-option { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 9px; transition: background 0.1s; text-align: left; }
        .cv-tag-option:hover { background: var(--surface3); }
        .cv-tag-option.checked { background: var(--primary-light); }
        .cv-tag-option .tag-chip { font-size: 11.5px; padding: 3px 10px; }
        .cv-tag-check { width: 18px; height: 18px; border-radius: 5px; border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; transition: all 0.12s; }
        .cv-tag-check.on { background: var(--primary); border-color: var(--primary); }
        .cv-tag-check .cv-sending-dot { width: 12px; height: 12px; border-width: 2px; }
        .cv-tag-option:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

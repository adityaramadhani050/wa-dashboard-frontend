import { useState, useEffect, useCallback } from 'react'
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  getQuickMedia, uploadQuickMedia, deleteQuickMedia,
  getTags, createTag, updateTag, deleteTag,
  getProducts, createProduct, updateProduct, deleteProduct,
  getBroadcastTemplates, createBroadcastTemplate, updateBroadcastTemplate, deleteBroadcastTemplate,
} from '../hooks/useApi'
import { Plus, Pencil, Trash2, X, MessageSquareText, Image as ImageIcon, FileText, Tag as TagIcon, Package, Megaphone, Zap, Search, Film } from 'lucide-react'
import PdfThumb, { isPdf } from '../components/PdfThumb'
import { useAuth } from '../context/AuthContext'

const EMPTY_TEMPLATE = { title: '', body: '', shortcut: '', category: '' }
const EMPTY_TAG = { name: '', color: '#3563e9' }
const TAG_COLORS = ['#3563e9', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#c026d3', '#7c3aed', '#64748b']
const EMPTY_PRODUCT = { name: '', category: '', capacity: '', price: '', specs: '', active: true }

// Sorot variabel {{nama}} dsb. di pratinjau isi pesan
function WithVars({ text }) {
  const parts = String(text || '').split(/(\{\{\s*\w+\s*\}\})/g)
  return parts.map((p, i) => /^\{\{\s*\w+\s*\}\}$/.test(p) ? <span key={i} className="tp-var">{p}</span> : p)
}

function CardActions({ onEdit, onDelete }) {
  return (
    <div className="am-actions">
      {onEdit && <button className="am-icon-btn edit" onClick={onEdit} title="Edit" aria-label="Edit"><Pencil size={15} /></button>}
      <button className="am-icon-btn del" onClick={onDelete} title="Hapus" aria-label="Hapus"><Trash2 size={15} /></button>
    </div>
  )
}

function MediaThumb({ type, url, mimetype, label }) {
  if (type === 'image') return <img src={url} alt={label || ''} />
  if (isPdf(mimetype, url)) return <PdfThumb url={url} />
  return <div className="tp-media-doc-icon">{type === 'video' ? <Film size={28} /> : <FileText size={28} />}</div>
}

function Modal({ title, onClose, children }) {
  return (
    <div className="am-overlay" onClick={onClose}>
      <div className="am-modal" onClick={e => e.stopPropagation()}>
        <div className="am-modal-header">
          <h3>{title}</h3>
          <button className="am-close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TemplateForm({ initial, onSave, onClose, loading, error }) {
  const [form, setForm] = useState(initial || EMPTY_TEMPLATE)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Judul <span className="req">*</span></label>
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="contoh: Info Harga" required />
      </div>
      <div className="am-field">
        <label>Isi Pesan <span className="req">*</span></label>
        <textarea
          value={form.body}
          onChange={e => set('body', e.target.value)}
          placeholder="Halo {{nama}}, terima kasih sudah menghubungi kami..."
          rows={5}
          required
        />
        <span className="am-hint">Gunakan <code>{'{{nama}}'}</code> untuk menyisipkan nama kontak otomatis</span>
      </div>
      <div className="am-field">
        <label>Shortcut <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input
          value={form.shortcut || ''}
          onChange={e => set('shortcut', e.target.value)}
          placeholder="contoh: harga (ketik /harga di chat)"
        />
      </div>
      <div className="am-field">
        <label>Kategori <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="contoh: Umum" />
      </div>
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

function BroadcastTemplateForm({ initial, onSave, onClose, loading, error }) {
  const [name, setName] = useState(initial?.name || '')
  const [body, setBody] = useState(initial?.body || '')
  const [file, setFile] = useState(null)
  const [removeMedia, setRemoveMedia] = useState(false)
  const hasExistingMedia = !!initial?.media_url && !removeMedia

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!body.trim() && !file && !hasExistingMedia) return
    onSave({ name, body, file, removeMedia })
  }

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Nama Template <span className="req">*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="contoh: Follow-up harga" required />
      </div>
      <div className="am-field">
        <label>Isi Pesan</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
          placeholder="Halo {{nama}}, ada promo spesial untuk Anda..." />
        <span className="am-hint">Gunakan <code>{'{{nama}}'}</code> untuk menyapa nama customer otomatis</span>
      </div>
      <div className="am-field">
        <label>Media <span style={{fontSize:11,color:'var(--muted)'}}>(opsional — gambar/video/dokumen)</span></label>
        {hasExistingMedia && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
            {initial.media_type === 'image'
              ? <img src={initial.media_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
              : isPdf(initial.media_mimetype, initial.media_url)
                ? <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}><PdfThumb url={initial.media_url} width={80} /></div>
                : <FileText size={22} />}
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{initial.media_filename || 'Media terlampir'}</span>
            <button type="button" className="am-icon-btn del" onClick={() => setRemoveMedia(true)} title="Hapus media"><Trash2 size={14} /></button>
          </div>
        )}
        <input type="file" accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] || null)} />
        <span className="am-hint">Kosongkan bila cukup teks saja. {hasExistingMedia ? 'Pilih file baru untuk mengganti media.' : ''}</span>
      </div>
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

function QuickMediaForm({ onSave, onClose, loading, error }) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!label.trim() || !file) return
    onSave({ file, label, category })
  }

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Label <span className="req">*</span></label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="contoh: Katalog Produk A" required />
      </div>
      <div className="am-field">
        <label>Kategori <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="contoh: Katalog" />
      </div>
      <div className="am-field">
        <label>File <span className="req">*</span></label>
        <input
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] || null)}
          required
        />
        <span className="am-hint">Gambar, video, atau dokumen</span>
      </div>
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading}>
          {loading ? 'Mengunggah...' : 'Unggah'}
        </button>
      </div>
    </form>
  )
}

function TagForm({ initial, onSave, onClose, loading, error }) {
  const [form, setForm] = useState(initial || EMPTY_TAG)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Nama Label <span className="req">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="contoh: VIP" required />
      </div>
      <div className="am-field">
        <label>Warna</label>
        <div className="tp-swatches">
          {TAG_COLORS.map(c => (
            <button key={c} type="button" className={`tp-swatch${(form.color || '').toLowerCase() === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
          ))}
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(form.color || '') ? form.color : '#3563e9'} onChange={e => set('color', e.target.value)} className="tp-color-input" title="Warna lain" />
        </div>
        <div className="tp-tag-preview">Pratinjau: <span className="tag-chip" style={{ background: form.color }}>{form.name || 'Label'}</span></div>
      </div>
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

function ProductForm({ initial, onSave, onClose, loading, error }) {
  const [form, setForm] = useState(initial || EMPTY_PRODUCT)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Nama Produk <span className="req">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="contoh: Paket PLTS Hybrid 2000W" required />
      </div>
      <div className="am-field">
        <label>Kategori <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="contoh: Hybrid / On-grid / Paket Rumah" />
      </div>
      <div className="am-field">
        <label>Kapasitas <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input value={form.capacity || ''} onChange={e => set('capacity', e.target.value)} placeholder="contoh: 2000W / 3 kWp" />
      </div>
      <div className="am-field">
        <label>Harga <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input value={form.price || ''} onChange={e => set('price', e.target.value)} placeholder="contoh: Rp 30.000.000 atau mulai 25jt" />
      </div>
      <div className="am-field">
        <label>Spesifikasi & Poin Jual <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <textarea value={form.specs || ''} onChange={e => set('specs', e.target.value)} placeholder="contoh: panel 4x550W, inverter hybrid, baterai 5kWh, garansi 25 tahun, hemat s/d 40%" rows={4} />
        <span className="am-hint">Dipakai AI sebagai sumber harga/spek saat membuat saran balasan</span>
      </div>
      <div className="am-field">
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} style={{width:16,height:16}} />
          Aktif (dipakai AI)
        </label>
      </div>
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

export default function TemplatesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  // Agent: hanya boleh mengubah/menghapus item buatannya sendiri (admin: semua)
  const canEdit = (item) => isAdmin || (item?.created_by != null && String(item.created_by) === String(user?.id))
  const [tab, setTabState] = useState(() => { try { return sessionStorage.getItem('tp_tab') || 'templates' } catch { return 'templates' } }) // 'templates' | 'broadcast' | 'media' | 'tags' | 'products'
  const [q, setQ] = useState('')
  const setTab = (t) => { setTabState(t); setQ(''); try { sessionStorage.setItem('tp_tab', t) } catch {} }

  // Broadcast templates state
  const [bcTemplates, setBcTemplates] = useState([])
  const [loadingBc, setLoadingBc] = useState(true)
  const [bcModal, setBcModal] = useState(null)
  const [bcSaving, setBcSaving] = useState(false)
  const [bcError, setBcError] = useState('')
  const [bcDeleteTarget, setBcDeleteTarget] = useState(null)
  const [bcDeleting, setBcDeleting] = useState(false)

  // Templates state
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [tplModal, setTplModal] = useState(null)
  const [tplSaving, setTplSaving] = useState(false)
  const [tplError, setTplError] = useState('')
  const [tplDeleteTarget, setTplDeleteTarget] = useState(null)
  const [tplDeleting, setTplDeleting] = useState(false)

  // Quick media state
  const [media, setMedia] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [mediaModal, setMediaModal] = useState(false)
  const [mediaSaving, setMediaSaving] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [mediaDeleteTarget, setMediaDeleteTarget] = useState(null)
  const [mediaDeleting, setMediaDeleting] = useState(false)

  // Tags state
  const [tags, setTags] = useState([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [tagModal, setTagModal] = useState(null)
  const [tagSaving, setTagSaving] = useState(false)
  const [tagError, setTagError] = useState('')
  const [tagDeleteTarget, setTagDeleteTarget] = useState(null)
  const [tagDeleting, setTagDeleting] = useState(false)

  // Products state
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [prodModal, setProdModal] = useState(null)
  const [prodSaving, setProdSaving] = useState(false)
  const [prodError, setProdError] = useState('')
  const [prodDeleteTarget, setProdDeleteTarget] = useState(null)
  const [prodDeleting, setProdDeleting] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try { setTemplates(await getTemplates()) } catch {}
    finally { setLoadingTemplates(false) }
  }, [])

  const loadMedia = useCallback(async () => {
    setLoadingMedia(true)
    try { setMedia(await getQuickMedia()) } catch {}
    finally { setLoadingMedia(false) }
  }, [])

  const loadTags = useCallback(async () => {
    setLoadingTags(true)
    try { setTags(await getTags()) } catch {}
    finally { setLoadingTags(false) }
  }, [])

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try { setProducts(await getProducts()) } catch {}
    finally { setLoadingProducts(false) }
  }, [])

  const loadBc = useCallback(async () => {
    setLoadingBc(true)
    try { setBcTemplates(await getBroadcastTemplates()) } catch {}
    finally { setLoadingBc(false) }
  }, [])

  useEffect(() => {
    loadTemplates(); loadMedia()
    // Template broadcast, label & katalog hanya untuk admin
    if (isAdmin) { loadTags(); loadProducts(); loadBc() }
  }, [isAdmin, loadTemplates, loadMedia, loadTags, loadProducts, loadBc])

  const handleSaveBc = async ({ name, body, file, removeMedia }) => {
    setBcSaving(true); setBcError('')
    try {
      if (bcModal?.template) {
        const updated = await updateBroadcastTemplate(bcModal.template.id, { name, body, file, removeMedia })
        setBcTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
      } else {
        const created = await createBroadcastTemplate(name, body, file)
        setBcTemplates(prev => [created, ...prev])
      }
      setBcModal(null)
    } catch (e) { setBcError(e.response?.data?.error || 'Gagal menyimpan template broadcast') }
    finally { setBcSaving(false) }
  }

  const handleDeleteBc = async () => {
    setBcDeleting(true)
    try {
      await deleteBroadcastTemplate(bcDeleteTarget.id)
      setBcTemplates(prev => prev.filter(t => t.id !== bcDeleteTarget.id))
      setBcDeleteTarget(null)
    } catch {}
    finally { setBcDeleting(false) }
  }

  const handleCreateTemplate = async (form) => {
    setTplSaving(true); setTplError('')
    try {
      const tpl = await createTemplate(form)
      setTemplates(prev => [tpl, ...prev])
      setTplModal(null)
    } catch (e) { setTplError(e.response?.data?.error || 'Gagal membuat template') }
    finally { setTplSaving(false) }
  }

  const handleUpdateTemplate = async (form) => {
    setTplSaving(true); setTplError('')
    try {
      const updated = await updateTemplate(tplModal.template.id, form)
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
      setTplModal(null)
    } catch (e) { setTplError(e.response?.data?.error || 'Gagal mengupdate template') }
    finally { setTplSaving(false) }
  }

  const handleDeleteTemplate = async () => {
    setTplDeleting(true)
    try {
      await deleteTemplate(tplDeleteTarget.id)
      setTemplates(prev => prev.filter(t => t.id !== tplDeleteTarget.id))
      setTplDeleteTarget(null)
    } catch {}
    finally { setTplDeleting(false) }
  }

  const handleUploadMedia = async ({ file, label, category }) => {
    setMediaSaving(true); setMediaError('')
    try {
      const item = await uploadQuickMedia(file, label, category)
      setMedia(prev => [item, ...prev])
      setMediaModal(false)
    } catch (e) { setMediaError(e.response?.data?.error || 'Gagal mengunggah media') }
    finally { setMediaSaving(false) }
  }

  const handleDeleteMedia = async () => {
    setMediaDeleting(true)
    try {
      await deleteQuickMedia(mediaDeleteTarget.id)
      setMedia(prev => prev.filter(m => m.id !== mediaDeleteTarget.id))
      setMediaDeleteTarget(null)
    } catch {}
    finally { setMediaDeleting(false) }
  }

  const handleCreateTag = async (form) => {
    setTagSaving(true); setTagError('')
    try {
      const tag = await createTag(form)
      setTags(prev => [tag, ...prev])
      setTagModal(null)
    } catch (e) { setTagError(e.response?.data?.error || 'Gagal membuat tag') }
    finally { setTagSaving(false) }
  }

  const handleUpdateTag = async (form) => {
    setTagSaving(true); setTagError('')
    try {
      const updated = await updateTag(tagModal.tag.id, form)
      setTags(prev => prev.map(t => t.id === updated.id ? updated : t))
      setTagModal(null)
    } catch (e) { setTagError(e.response?.data?.error || 'Gagal mengupdate tag') }
    finally { setTagSaving(false) }
  }

  const handleDeleteTag = async () => {
    setTagDeleting(true)
    try {
      await deleteTag(tagDeleteTarget.id)
      setTags(prev => prev.filter(t => t.id !== tagDeleteTarget.id))
      setTagDeleteTarget(null)
    } catch {}
    finally { setTagDeleting(false) }
  }

  const handleCreateProduct = async (form) => {
    setProdSaving(true); setProdError('')
    try {
      const p = await createProduct(form)
      setProducts(prev => [p, ...prev])
      setProdModal(null)
    } catch (e) { setProdError(e.response?.data?.error || 'Gagal membuat produk') }
    finally { setProdSaving(false) }
  }

  const handleUpdateProduct = async (form) => {
    setProdSaving(true); setProdError('')
    try {
      const updated = await updateProduct(prodModal.product.id, form)
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setProdModal(null)
    } catch (e) { setProdError(e.response?.data?.error || 'Gagal mengupdate produk') }
    finally { setProdSaving(false) }
  }

  const handleDeleteProduct = async () => {
    setProdDeleting(true)
    try {
      await deleteProduct(prodDeleteTarget.id)
      setProducts(prev => prev.filter(p => p.id !== prodDeleteTarget.id))
      setProdDeleteTarget(null)
    } catch {}
    finally { setProdDeleting(false) }
  }

  const match = (...fields) => !q.trim() || fields.some(f => String(f || '').toLowerCase().includes(q.trim().toLowerCase()))
  const fTemplates = templates.filter(t => match(t.title, t.body, t.shortcut, t.category))
  const fBc = bcTemplates.filter(t => match(t.name, t.body))
  const fMedia = media.filter(m => match(m.label, m.category))
  const fTags = tags.filter(t => match(t.name))
  const fProducts = products.filter(p => match(p.name, p.category, p.capacity, p.specs))

  const ALL_TABS = [
    { key: 'templates', label: 'Template Pesan', short: 'Template', icon: MessageSquareText, count: templates.length, add: 'Tambah Template', onAdd: () => { setTplError(''); setTplModal('create') } },
    { key: 'broadcast', label: 'Template Broadcast', short: 'Broadcast', icon: Megaphone, count: bcTemplates.length, add: 'Tambah Template', onAdd: () => { setBcError(''); setBcModal('create') } },
    { key: 'media', label: 'Galeri Produk', short: 'Galeri', icon: ImageIcon, count: media.length, add: 'Tambah Media', onAdd: () => { setMediaError(''); setMediaModal(true) } },
    { key: 'tags', label: 'Label Percakapan', short: 'Label', icon: TagIcon, count: tags.length, add: 'Tambah Label', onAdd: () => { setTagError(''); setTagModal('create') } },
    { key: 'products', label: 'Katalog Produk', short: 'Katalog', icon: Package, count: products.length, add: 'Tambah Produk', onAdd: () => { setProdError(''); setProdModal('create') } },
  ]
  // Agent hanya melihat Template Pesan & Galeri Produk
  const TABS = isAdmin ? ALL_TABS : ALL_TABS.filter(t => t.key === 'templates' || t.key === 'media')
  const cur = TABS.find(t => t.key === tab) || TABS[0]
  const tabKey = cur.key

  const loadingView = (
    <div className="tp-grid">{[...Array(4)].map((_, i) => <div key={i} className="am-skel tp-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}</div>
  )
  const emptyView = (Icon, text) => (
    <div className="am-empty">
      <Icon size={36} strokeWidth={1.4} />
      <p>{q ? 'Tidak ada yang cocok dengan pencarian.' : text}</p>
      {!q && <button className="am-btn primary" onClick={cur.onAdd}><Plus size={15} />{cur.add}</button>}
    </div>
  )

  return (
    <div className="am-page">
      <div className="am-header">
        <h1><Zap size={21} />Template & Galeri</h1>
        <button className="am-btn primary" onClick={cur.onAdd}>
          <Plus size={16} /><span className="tp-hide-xs">{cur.add}</span>
        </button>
      </div>

      <div className="am-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tabKey === t.key} className={`am-tab${tabKey === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /><span className="tp-tab-full">{t.label}</span><span className="tp-tab-short">{t.short}</span>
            <span className="am-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="tp-toolbar">
        <div className="tp-search">
          <Search size={15} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Cari di ${cur.label.toLowerCase()}…`} />
          {q && <button onClick={() => setQ('')} aria-label="Hapus pencarian"><X size={14} /></button>}
        </div>
        {tabKey === 'templates' && <span className="tp-tip">Ketik <b>/shortcut</b> di kolom chat untuk memakai template.</span>}
        {tabKey === 'products' && <span className="tp-tip">Produk aktif dipakai AI sebagai acuan harga & spesifikasi.</span>}
      </div>

      {tabKey === 'templates' && (
        loadingTemplates ? loadingView : fTemplates.length === 0 ? emptyView(MessageSquareText, "Belum ada template pesan.") : (
          <div className="tp-grid">
            {fTemplates.map(t => (
              <div key={t.id} className="tp-card">
                <div className="tp-card-head">
                  <div className="tp-card-titles">
                    <span className="tp-card-title">{t.title}</span>
                    <span className="tp-card-meta">
                      {t.shortcut && <span className="tp-pill shortcut">/{t.shortcut}</span>}
                      {t.category && <span className="tp-pill">{t.category}</span>}
                    </span>
                  </div>
                  {canEdit(t) && <CardActions onEdit={() => { setTplError(''); setTplModal({ template: t }) }} onDelete={() => setTplDeleteTarget(t)} />}
                </div>
                <div className="tp-card-body"><WithVars text={t.body} /></div>
              </div>
            ))}
          </div>
        )
      )}

      {tabKey === 'broadcast' && (
        loadingBc ? loadingView : fBc.length === 0 ? emptyView(Megaphone, "Belum ada template broadcast. Buat pesan promo siap-pakai di sini.") : (
          <div className="tp-grid">
            {fBc.map(t => (
              <div key={t.id} className="tp-card">
                {t.media_url && (
                  <div className="tp-card-media"><MediaThumb type={t.media_type} url={t.media_url} mimetype={t.media_mimetype} label={t.name} /></div>
                )}
                <div className="tp-card-head">
                  <div className="tp-card-titles">
                    <span className="tp-card-title">{t.name}</span>
                    {t.media_url && <span className="tp-card-meta"><span className="tp-pill">{t.media_type === 'image' ? 'Gambar' : t.media_type === 'video' ? 'Video' : 'Dokumen'}</span></span>}
                  </div>
                  <CardActions onEdit={() => { setBcError(''); setBcModal({ template: t }) }} onDelete={() => setBcDeleteTarget(t)} />
                </div>
                {t.body ? <div className="tp-card-body"><WithVars text={t.body} /></div> : <div className="tp-card-body muted">Tanpa teks (hanya media)</div>}
              </div>
            ))}
          </div>
        )
      )}

      {tabKey === 'media' && (
        loadingMedia ? loadingView : fMedia.length === 0 ? emptyView(ImageIcon, "Belum ada media di galeri. Media di sini bisa dikirim cepat dari menu Produk / katalog di chat.") : (
          <div className="tp-media-grid">
            {fMedia.map(m => (
              <div key={m.id} className="tp-media-card">
                <div className="tp-media-thumb"><MediaThumb type={m.media_type} url={m.media_url} mimetype={m.mimetype} label={m.label} /></div>
                <div className="tp-media-info">
                  <span className="tp-media-label" title={m.label}>{m.label}</span>
                  {m.category && <span className="tp-media-cat">{m.category}</span>}
                </div>
                {canEdit(m) && <button className="tp-media-del" onClick={() => setMediaDeleteTarget(m)} title="Hapus" aria-label="Hapus"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        )
      )}

      {tabKey === 'tags' && (
        loadingTags ? loadingView : fTags.length === 0 ? emptyView(TagIcon, "Belum ada label percakapan.") : (
          <div className="tp-tag-grid">
            {fTags.map(t => (
              <div key={t.id} className="tp-tag-item">
                <span className="tp-tag-dot" style={{ background: t.color }} />
                <span className="tag-chip" style={{ background: t.color }}>{t.name}</span>
                <span className="tp-tag-hex">{t.color}</span>
                <CardActions onEdit={() => { setTagError(''); setTagModal({ tag: t }) }} onDelete={() => setTagDeleteTarget(t)} />
              </div>
            ))}
          </div>
        )
      )}

      {tabKey === 'products' && (
        loadingProducts ? loadingView : fProducts.length === 0 ? emptyView(Package, "Belum ada produk. Isi katalog agar AI bisa menjawab harga & spesifikasi.") : (
          <div className="tp-grid">
            {fProducts.map(p => (
              <div key={p.id} className={`tp-card${p.active === false ? ' inactive' : ''}`}>
                <div className="tp-card-head">
                  <div className="tp-card-titles">
                    <span className="tp-card-title">{p.name}</span>
                    <span className="tp-card-meta">
                      <span className={`tp-pill ${p.active !== false ? 'ok' : ''}`}>{p.active !== false ? 'Aktif' : 'Nonaktif'}</span>
                      {p.category && <span className="tp-pill">{p.category}</span>}
                      {p.capacity && <span className="tp-pill">{p.capacity}</span>}
                    </span>
                  </div>
                  <CardActions onEdit={() => { setProdError(''); setProdModal({ product: p }) }} onDelete={() => setProdDeleteTarget(p)} />
                </div>
                {p.price && <div className="tp-price">{p.price}</div>}
                {p.specs && <div className="tp-card-body">{p.specs}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {prodModal === 'create' && (
        <Modal title="Tambah Produk Baru" onClose={() => setProdModal(null)}>
          <ProductForm onSave={handleCreateProduct} onClose={() => setProdModal(null)} loading={prodSaving} error={prodError} />
        </Modal>
      )}

      {prodModal?.product && (
        <Modal title="Edit Produk" onClose={() => setProdModal(null)}>
          <ProductForm initial={prodModal.product} onSave={handleUpdateProduct} onClose={() => setProdModal(null)} loading={prodSaving} error={prodError} />
        </Modal>
      )}

      {prodDeleteTarget && (
        <Modal title="Hapus Produk" onClose={() => setProdDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus produk <strong>{prodDeleteTarget.name}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setProdDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDeleteProduct} disabled={prodDeleting}>
                {prodDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tplModal === 'create' && (
        <Modal title="Tambah Template Baru" onClose={() => setTplModal(null)}>
          <TemplateForm onSave={handleCreateTemplate} onClose={() => setTplModal(null)} loading={tplSaving} error={tplError} />
        </Modal>
      )}

      {tplModal?.template && (
        <Modal title="Edit Template" onClose={() => setTplModal(null)}>
          <TemplateForm initial={tplModal.template} onSave={handleUpdateTemplate} onClose={() => setTplModal(null)} loading={tplSaving} error={tplError} />
        </Modal>
      )}

      {tplDeleteTarget && (
        <Modal title="Hapus Template" onClose={() => setTplDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus template <strong>{tplDeleteTarget.title}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setTplDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDeleteTemplate} disabled={tplDeleting}>
                {tplDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {bcModal === 'create' && (
        <Modal title="Tambah Template Broadcast" onClose={() => setBcModal(null)}>
          <BroadcastTemplateForm onSave={handleSaveBc} onClose={() => setBcModal(null)} loading={bcSaving} error={bcError} />
        </Modal>
      )}

      {bcModal?.template && (
        <Modal title="Edit Template Broadcast" onClose={() => setBcModal(null)}>
          <BroadcastTemplateForm initial={bcModal.template} onSave={handleSaveBc} onClose={() => setBcModal(null)} loading={bcSaving} error={bcError} />
        </Modal>
      )}

      {bcDeleteTarget && (
        <Modal title="Hapus Template Broadcast" onClose={() => setBcDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus template <strong>{bcDeleteTarget.name}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setBcDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDeleteBc} disabled={bcDeleting}>
                {bcDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {mediaModal && (
        <Modal title="Tambah Media Galeri" onClose={() => setMediaModal(false)}>
          <QuickMediaForm onSave={handleUploadMedia} onClose={() => setMediaModal(false)} loading={mediaSaving} error={mediaError} />
        </Modal>
      )}

      {mediaDeleteTarget && (
        <Modal title="Hapus Media" onClose={() => setMediaDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus media <strong>{mediaDeleteTarget.label}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setMediaDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDeleteMedia} disabled={mediaDeleting}>
                {mediaDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tagModal === 'create' && (
        <Modal title="Tambah Label Baru" onClose={() => setTagModal(null)}>
          <TagForm onSave={handleCreateTag} onClose={() => setTagModal(null)} loading={tagSaving} error={tagError} />
        </Modal>
      )}

      {tagModal?.tag && (
        <Modal title="Edit Label" onClose={() => setTagModal(null)}>
          <TagForm initial={tagModal.tag} onSave={handleUpdateTag} onClose={() => setTagModal(null)} loading={tagSaving} error={tagError} />
        </Modal>
      )}

      {tagDeleteTarget && (
        <Modal title="Hapus Label" onClose={() => setTagDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus label <strong>{tagDeleteTarget.name}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setTagDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDeleteTag} disabled={tagDeleting}>
                {tagDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .am-page { padding: 24px 24px 40px; width: 100%; color: var(--text); }
        .am-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
        .am-header h1 { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; color: var(--text); }
        .am-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 600; transition: all 0.15s; white-space: nowrap; }
        .am-btn.primary { background: var(--primary); color: var(--on-primary); }
        .am-btn.primary:hover:not(:disabled) { background: var(--primary-hover); }
        .am-btn.secondary { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .am-btn.secondary:hover { background: var(--surface3); }
        .am-btn.danger { background: rgba(229,62,62,0.1); color: var(--danger); border: 1px solid rgba(229,62,62,0.3); }
        .am-btn.danger:hover:not(:disabled) { background: rgba(229,62,62,0.16); }
        .am-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        /* Tab */
        .am-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); overflow-x: auto; scrollbar-width: none; }
        .am-tabs::-webkit-scrollbar { display: none; }
        .am-tab { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
        .am-tab:hover:not(.active) { background: var(--surface3); }
        .am-tab.active { background: var(--primary); color: var(--on-primary); box-shadow: 0 1px 3px var(--shadow); }
        .am-tab-count { font-size: 11px; font-weight: 700; padding: 0 6px; border-radius: 999px; background: var(--surface3); color: var(--text2); }
        .am-tab.active .am-tab-count { background: rgba(255,255,255,0.25); color: var(--on-primary); }
        .tp-tab-short { display: none; }
        /* Toolbar */
        .tp-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .tp-search { display: flex; align-items: center; gap: 8px; flex: 1 1 260px; max-width: 420px; height: 40px; padding: 0 10px 0 12px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); color: var(--muted); transition: border-color 0.15s; }
        .tp-search:focus-within { border-color: var(--primary); }
        .tp-search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text); font-size: 13.5px; font-family: inherit; }
        .tp-search button { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .tp-search button:hover { background: var(--surface3); color: var(--text); }
        .tp-tip { font-size: 12.5px; color: var(--muted); }
        .tp-tip b { color: var(--text2); font-family: ui-monospace, monospace; font-weight: 600; }
        /* Kartu */
        .tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; align-items: start; }
        .tp-skel { height: 130px; }
        .tp-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px 12px 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 1px 3px var(--shadow); transition: border-color 0.15s; }
        .tp-card:hover { border-color: var(--border2); }
        .tp-card.inactive { opacity: 0.7; }
        .tp-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .tp-card-titles { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .tp-card-title { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.35; }
        .tp-card-meta { display: flex; gap: 5px; flex-wrap: wrap; }
        .tp-pill { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--surface3); color: var(--text2); white-space: nowrap; }
        .tp-pill.shortcut { background: var(--primary-light); color: var(--primary); font-family: ui-monospace, monospace; }
        .tp-pill.ok { background: rgba(39,168,122,0.14); color: var(--success); }
        .tp-card-body { font-size: 13px; color: var(--text2); line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .tp-card-body.muted { color: var(--muted); font-style: italic; }
        .tp-var { color: var(--primary); background: var(--primary-light); border-radius: 4px; padding: 0 3px; font-weight: 600; }
        .tp-card-media { margin: -14px -12px 0 -16px; height: 130px; border-radius: 12px 12px 0 0; overflow: hidden; background: var(--surface3); display: flex; align-items: center; justify-content: center; }
        .tp-card-media img { width: 100%; height: 100%; object-fit: cover; }
        .tp-price { font-size: 15px; font-weight: 800; color: var(--primary); }
        .am-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .am-icon-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .am-icon-btn.edit:hover { background: var(--primary-light); color: var(--primary); }
        .am-icon-btn.del:hover { background: rgba(229,62,62,0.1); color: var(--danger); }
        .am-skel { background: var(--skeleton); border-radius: 12px; animation: pulse 1.4s ease infinite; }
        .am-empty { padding: 56px 20px; text-align: center; color: var(--muted); font-size: 13.5px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: var(--surface); border: 1px dashed var(--border2); border-radius: 12px; }
        .am-empty p { max-width: 420px; line-height: 1.5; }
        /* Galeri */
        .tp-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
        .tp-media-card { position: relative; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: 0 1px 3px var(--shadow); }
        .tp-media-thumb { width: 100%; height: 130px; background: var(--surface3); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .tp-media-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .tp-media-doc-icon { color: var(--muted); }
        .tp-media-info { padding: 9px 11px; display: flex; flex-direction: column; gap: 2px; }
        .tp-media-label { font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tp-media-cat { font-size: 11px; color: var(--muted); }
        .tp-media-del { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,0.6); color: #fff; opacity: 0.85; transition: opacity 0.15s, background 0.15s; }
        .tp-media-del:hover { opacity: 1; background: var(--danger); }
        /* Label */
        .tp-tag-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
        .tp-tag-item { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; min-width: 0; }
        .tp-tag-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; display: none; }
        .tp-tag-hex { flex: 1; font-size: 11.5px; color: var(--muted); font-family: ui-monospace, monospace; }
        .tp-swatches { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .tp-swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35); }
        .tp-swatch.on { border-color: var(--text); }
        .tp-color-input { width: 36px !important; height: 30px !important; padding: 2px !important; border-radius: 8px !important; cursor: pointer; }
        .tp-tag-preview { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
        .tag-chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: var(--on-primary); white-space: nowrap; }
        /* Modal */
        .am-overlay { position: fixed; inset: 0; z-index: 500; background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .am-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; max-height: calc(100vh - 32px); overflow-y: auto; }
        .am-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
        .am-modal-header h3 { font-size: 15px; font-weight: 700; color: var(--text); }
        .am-close { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .am-close:hover { background: var(--surface3); color: var(--text2); }
        .am-form { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
        .am-field { display: flex; flex-direction: column; gap: 6px; }
        .am-field label { font-size: 12px; color: var(--text2); font-weight: 600; }
        .am-field input:not([type=checkbox]):not([type=file]):not([type=color]), .am-field select { height: 40px; }
        .am-field input, .am-field select, .am-field textarea { background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); padding: 0 12px; font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
        .am-field textarea { padding: 10px 12px; resize: vertical; line-height: 1.5; }
        .am-field input[type=file] { padding: 8px; font-size: 13px; }
        .am-field input:focus, .am-field select:focus, .am-field textarea:focus { border-color: var(--primary); background: var(--surface); }
        .am-field input::placeholder, .am-field textarea::placeholder { color: var(--muted); }
        .am-field code { font-size: 11.5px; color: var(--primary); }
        .req { color: var(--danger); }
        .am-hint { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
        .am-hint.err { color: var(--danger); }
        .am-form-err { padding: 10px 14px; background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.3); border-radius: 9px; color: var(--danger); font-size: 13px; }
        .am-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
        .am-confirm { padding: 18px; }
        .am-confirm p { font-size: 14px; color: var(--text); margin-bottom: 6px; }
        .am-confirm-sub { font-size: 13px; color: var(--text2); }
        .am-confirm .am-form-actions { margin-top: 18px; }
        @media (max-width: 768px) {
          .am-page { padding: 16px 14px 28px; }
          .am-tab { flex: 0 0 auto; }
          .tp-tab-full { display: none; } .tp-tab-short { display: inline; }
          .tp-search { max-width: none; }
          .tp-tip { display: none; }
          .tp-grid { grid-template-columns: 1fr; }
          .tp-media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .tp-media-thumb { height: 110px; }
          .tp-tag-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 420px) { .tp-hide-xs { display: none; } .am-header .am-btn { width: 38px; padding: 0; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

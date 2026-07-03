import { useState, useEffect, useCallback } from 'react'
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  getQuickMedia, uploadQuickMedia, deleteQuickMedia,
  getTags, createTag, updateTag, deleteTag,
  getProducts, createProduct, updateProduct, deleteProduct,
} from '../hooks/useApi'
import { Plus, Pencil, Trash2, X, MessageSquareText, Image as ImageIcon, FileText, Tag as TagIcon, Package } from 'lucide-react'

const EMPTY_TEMPLATE = { title: '', body: '', shortcut: '', category: '' }
const EMPTY_TAG = { name: '', color: 'var(--primary)' }
const EMPTY_PRODUCT = { name: '', category: '', capacity: '', price: '', specs: '', active: true }

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
        <label>Nama Tag <span className="req">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="contoh: VIP" required />
      </div>
      <div className="am-field">
        <label>Warna</label>
        <input type="color" value={form.color || 'var(--primary)'} onChange={e => set('color', e.target.value)} style={{ width: 60, height: 36, padding: 2 }} />
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
  const [tab, setTab] = useState('templates') // 'templates' | 'media' | 'tags' | 'products'

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

  useEffect(() => { loadTemplates(); loadMedia(); loadTags(); loadProducts() }, [loadTemplates, loadMedia, loadTags, loadProducts])

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

  return (
    <div className="am-page">
      <div className="am-header">
        <div>
          <h1>Template & Galeri Produk</h1>
          <p>Kelola template pesan cepat dan galeri media untuk dikirim ke customer</p>
        </div>
        {tab === 'templates' && (
          <button className="am-btn primary" onClick={() => { setTplError(''); setTplModal('create') }}>
            <Plus size={16} /> Tambah Template
          </button>
        )}
        {tab === 'media' && (
          <button className="am-btn primary" onClick={() => { setMediaError(''); setMediaModal(true) }}>
            <Plus size={16} /> Tambah Media
          </button>
        )}
        {tab === 'tags' && (
          <button className="am-btn primary" onClick={() => { setTagError(''); setTagModal('create') }}>
            <Plus size={16} /> Tambah Tag
          </button>
        )}
        {tab === 'products' && (
          <button className="am-btn primary" onClick={() => { setProdError(''); setProdModal('create') }}>
            <Plus size={16} /> Tambah Produk
          </button>
        )}
      </div>

      <div className="tp-tabs">
        <button className={`tp-tab${tab === 'templates' ? ' active' : ''}`} onClick={() => setTab('templates')}>
          <MessageSquareText size={15} /> Template Pesan
        </button>
        <button className={`tp-tab${tab === 'media' ? ' active' : ''}`} onClick={() => setTab('media')}>
          <ImageIcon size={15} /> Galeri Produk
        </button>
        <button className={`tp-tab${tab === 'tags' ? ' active' : ''}`} onClick={() => setTab('tags')}>
          <TagIcon size={15} /> Tag Percakapan
        </button>
        <button className={`tp-tab${tab === 'products' ? ' active' : ''}`} onClick={() => setTab('products')}>
          <Package size={15} /> Katalog Produk
        </button>
      </div>

      {tab === 'templates' && (
        <div className="am-table-box">
          {loadingTemplates ? (
            <div className="am-loading">
              {[...Array(3)].map((_, i) => <div key={i} className="am-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="am-empty">
              <MessageSquareText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Belum ada template. Klik "Tambah Template" untuk membuat.</p>
            </div>
          ) : (
            <div className="am-table-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Judul</th>
                    <th>Isi</th>
                    <th>Shortcut</th>
                    <th>Kategori</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td className="tp-body-cell">{t.body}</td>
                      <td>{t.shortcut ? <span className="am-username">/{t.shortcut}</span> : <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td>{t.category || <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td>
                        <div className="am-actions">
                          <button className="am-icon-btn edit" onClick={() => { setTplError(''); setTplModal({ template: t }) }} title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button className="am-icon-btn del" onClick={() => setTplDeleteTarget(t)} title="Hapus">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'media' && (
        <div className="am-table-box">
          {loadingMedia ? (
            <div className="am-loading">
              {[...Array(3)].map((_, i) => <div key={i} className="am-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}
            </div>
          ) : media.length === 0 ? (
            <div className="am-empty">
              <ImageIcon size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Belum ada media. Klik "Tambah Media" untuk mengunggah.</p>
            </div>
          ) : (
            <div className="tp-media-grid">
              {media.map(m => (
                <div key={m.id} className="tp-media-card">
                  <div className="tp-media-thumb">
                    {m.media_type === 'image'
                      ? <img src={m.media_url} alt={m.label} />
                      : <div className="tp-media-doc-icon"><FileText size={28} /></div>}
                  </div>
                  <div className="tp-media-info">
                    <span className="tp-media-label">{m.label}</span>
                    {m.category && <span className="tp-media-cat">{m.category}</span>}
                  </div>
                  <button className="am-icon-btn del tp-media-del" onClick={() => setMediaDeleteTarget(m)} title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tags' && (
        <div className="am-table-box">
          {loadingTags ? (
            <div className="am-loading">
              {[...Array(3)].map((_, i) => <div key={i} className="am-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}
            </div>
          ) : tags.length === 0 ? (
            <div className="am-empty">
              <TagIcon size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Belum ada tag. Klik "Tambah Tag" untuk membuat.</p>
            </div>
          ) : (
            <div className="am-table-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Warna</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map(t => (
                    <tr key={t.id}>
                      <td><span className="tag-chip" style={{ background: t.color }}>{t.name}</span></td>
                      <td><span style={{color:'var(--text2)'}}>{t.color}</span></td>
                      <td>
                        <div className="am-actions">
                          <button className="am-icon-btn edit" onClick={() => { setTagError(''); setTagModal({ tag: t }) }} title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button className="am-icon-btn del" onClick={() => setTagDeleteTarget(t)} title="Hapus">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="am-table-box">
          {loadingProducts ? (
            <div className="am-loading">
              {[...Array(3)].map((_, i) => <div key={i} className="am-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="am-empty">
              <Package size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Belum ada produk. Klik "Tambah Produk" untuk mengisi katalog yang dipakai AI.</p>
            </div>
          ) : (
            <div className="am-table-wrap">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Kapasitas</th>
                    <th>Harga</th>
                    <th>Spesifikasi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.category || <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td>{p.capacity || <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td>{p.price || <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td className="tp-body-cell">{p.specs || <span style={{color:'var(--muted)'}}>-</span>}</td>
                      <td>
                        {p.active !== false
                          ? <span className="tag-chip" style={{ background: 'var(--success)' }}>Aktif</span>
                          : <span className="tag-chip" style={{ background: 'var(--muted)' }}>Nonaktif</span>}
                      </td>
                      <td>
                        <div className="am-actions">
                          <button className="am-icon-btn edit" onClick={() => { setProdError(''); setProdModal({ product: p }) }} title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button className="am-icon-btn del" onClick={() => setProdDeleteTarget(p)} title="Hapus">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
        <Modal title="Tambah Tag Baru" onClose={() => setTagModal(null)}>
          <TagForm onSave={handleCreateTag} onClose={() => setTagModal(null)} loading={tagSaving} error={tagError} />
        </Modal>
      )}

      {tagModal?.tag && (
        <Modal title="Edit Tag" onClose={() => setTagModal(null)}>
          <TagForm initial={tagModal.tag} onSave={handleUpdateTag} onClose={() => setTagModal(null)} loading={tagSaving} error={tagError} />
        </Modal>
      )}

      {tagDeleteTarget && (
        <Modal title="Hapus Tag" onClose={() => setTagDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus tag <strong>{tagDeleteTarget.name}</strong>?</p>
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
        .am-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; margin-bottom: 16px;
        }
        .am-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 3px; color: var(--text); }
        .am-header p { font-size: 13px; color: var(--text2); }
        .am-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px;
          font-size: 13px; font-weight: 600; transition: all 0.15s;
          white-space: nowrap;
        }
        .am-btn.primary { background: var(--primary); color: white; }
        .am-btn.primary:hover { background: var(--primary-hover); }
        .am-btn.secondary { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .am-btn.secondary:hover { background: var(--surface3); }
        .am-btn.danger { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
        .am-btn.danger:hover { background: #fee2e2; }
        .am-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .tp-tabs { display: flex; gap: 6px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
        .tp-tab { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; font-size: 13px; font-weight: 600; color: var(--text2); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; }
        .tp-tab:hover { color: var(--primary); }
        .tp-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
        .am-table-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .am-table-wrap { overflow-x: auto; }
        .am-table { width: 100%; border-collapse: collapse; }
        .am-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); background: var(--surface2); }
        .am-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid var(--surface3); color: var(--text); vertical-align: top; }
        .am-table tr:last-child td { border-bottom: none; }
        .am-table tr:hover td { background: var(--surface2); }
        .tp-body-cell { max-width: 360px; color: var(--text2); white-space: pre-wrap; }
        .am-username { font-size: 13px; color: var(--primary); font-weight: 500; font-family: monospace; }
        .am-actions { display: flex; gap: 6px; }
        .am-icon-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .am-icon-btn.edit { color: var(--muted); }
        .am-icon-btn.edit:hover { background: #eff6ff; color: var(--primary); }
        .am-icon-btn.del { color: var(--muted); }
        .am-icon-btn.del:hover { background: #fef2f2; color: var(--danger); }
        .am-loading { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .am-skel { height: 56px; background: var(--surface3); border-radius: 8px; animation: pulse 1.4s ease infinite; }
        .am-empty { padding: 60px 20px; text-align: center; color: var(--muted); font-size: 14px; display: flex; flex-direction: column; align-items: center; }
        .tp-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; padding: 16px; }
        .tp-media-card { position: relative; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface2); }
        .tp-media-thumb { width: 100%; height: 110px; background: #eef2f7; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .tp-media-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .tp-media-doc-icon { color: var(--muted); }
        .tp-media-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
        .tp-media-label { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tp-media-cat { font-size: 11px; color: var(--muted); }
        .tp-media-del { position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,0.9); }
        .am-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .am-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; max-height: 90vh; overflow-y: auto; }
        .am-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface2); }
        .am-modal-header h3 { font-size: 15px; font-weight: 600; color: var(--text); }
        .am-close { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .am-close:hover { background: var(--border); color: var(--text2); }
        .am-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .am-field { display: flex; flex-direction: column; gap: 5px; }
        .am-field label { font-size: 12px; color: var(--text2); font-weight: 600; }
        .am-field input, .am-field select, .am-field textarea { background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; color: var(--text); padding: 10px 14px; font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; resize: vertical; }
        .am-field input:focus, .am-field select:focus, .am-field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .am-field input::placeholder, .am-field textarea::placeholder { color: var(--border2); }
        .req { color: var(--danger); }
        .am-hint { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .am-hint.err { color: var(--danger); }
        .am-form-err { padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; color: var(--danger); font-size: 13px; }
        .am-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .am-confirm { padding: 20px; }
        .am-confirm p { font-size: 14px; color: var(--text); margin-bottom: 6px; }
        .am-confirm-sub { font-size: 13px; color: var(--text2); }
        .am-confirm .am-form-actions { margin-top: 20px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .tag-chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--on-primary); white-space: nowrap; }
      `}</style>
    </div>
  )
}

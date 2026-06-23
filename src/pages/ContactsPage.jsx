import { useState, useEffect } from 'react'
import { getContacts, updateContact } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { Search, Users, Phone, Calendar, Clock, EyeOff, Pencil, X } from 'lucide-react'

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })
}

function isLid(phone) {
  return phone?.includes('@lid')
}

function cleanPhone(phone) {
  if (!phone) return '-'
  if (isLid(phone)) return null
  return phone.split('@')[0]
}

function PhoneDisplay({ phone }) {
  if (isLid(phone)) {
    return (
      <span className="ct-phone-hidden">
        <EyeOff size={12} />
        Nomor tersembunyi
      </span>
    )
  }
  return <span className="ct-phone">{cleanPhone(phone)}</span>
}

function Avatar({ name }) {
  const letter = (name || '?')[0].toUpperCase()
  const colors = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
  const idx = letter.charCodeAt(0) % colors.length
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: colors[idx] + '22', color: colors[idx],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, flexShrink: 0,
    }}>{letter}</div>
  )
}

function EditContactModal({ contact, onClose, onSaved }) {
  const [name, setName] = useState(contact.name || '')
  const [manualWa, setManualWa] = useState(contact.manual_wa_number || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const updated = await updateContact(contact.id, { name, manual_wa_number: manualWa })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan kontak')
    } finally { setSaving(false) }
  }

  return (
    <div className="ct-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={e => e.stopPropagation()}>
        <div className="ct-modal-header">
          <h3>Edit Kontak</h3>
          <button className="ct-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="ct-form">
          <div className="ct-field">
            <label>Nama</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama kontak" />
          </div>
          <div className="ct-field">
            <label>No WA</label>
            <input value={manualWa} onChange={e => setManualWa(e.target.value)} placeholder="Contoh: 6281234567890" />
            <span className="ct-field-hint">Untuk referensi sales, tidak memengaruhi pengiriman pesan otomatis.</span>
          </div>
          {error && <div className="ct-form-err">{error}</div>}
          <div className="ct-form-actions">
            <button type="button" className="ct-btn secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="ct-btn primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    const agentId = user?.role === 'agent' ? user.id : null
    getContacts(agentId)
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(() => setError('Gagal memuat kontak.'))
      .finally(() => setLoading(false))
  }, [user])

  const handleSaved = (updated) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const phone = cleanPhone(c.phone) || ''
    return (
      c.name?.toLowerCase().includes(q) ||
      phone.includes(q) ||
      c.manual_wa_number?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="ct-root">
      {/* Header */}
      <div className="ct-header">
        <div className="ct-header-left">
          <div className="ct-header-icon"><Users size={20} /></div>
          <div>
            <h1 className="ct-title">Kontak</h1>
            <p className="ct-sub">{loading ? 'Memuat...' : `${contacts.length} kontak terdaftar`}</p>
          </div>
        </div>
        <div className="ct-search-wrap">
          <Search size={15} className="ct-search-icon" />
          <input
            className="ct-search"
            placeholder="Cari nama atau nomor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="ct-body">
        {error && <div className="ct-error">{error}</div>}

        {loading ? (
          <div className="ct-skel-list">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="ct-skel-row" style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ct-empty">
            <Users size={40} strokeWidth={1.2} />
            <p>{search ? 'Kontak tidak ditemukan' : 'Belum ada kontak'}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th><Phone size={13} style={{marginRight:4,verticalAlign:'middle'}}/>LID</th>
                    <th><Phone size={13} style={{marginRight:4,verticalAlign:'middle'}}/>No WA</th>
                    <th><Calendar size={13} style={{marginRight:4,verticalAlign:'middle'}}/>Pertama Chat</th>
                    <th><Clock size={13} style={{marginRight:4,verticalAlign:'middle'}}/>Terakhir Chat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="ct-name-cell">
                          <Avatar name={c.name} />
                          <span className="ct-name">{c.name || '-'}</span>
                        </div>
                      </td>
                      <td><PhoneDisplay phone={c.phone} /></td>
                      <td>{c.manual_wa_number
                        ? <span className="ct-phone">{c.manual_wa_number}</span>
                        : <span className="ct-no-wa">—</span>}</td>
                      <td><span className="ct-date">{formatDateTime(c.first_seen)}</span></td>
                      <td><span className="ct-date">{formatDateTime(c.last_message_at)}</span></td>
                      <td>
                        <button className="ct-edit-btn" title="Edit kontak" onClick={() => setEditTarget(c)}>
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="ct-card-list">
              {filtered.map(c => (
                <div key={c.id} className="ct-card">
                  <Avatar name={c.name} />
                  <div className="ct-card-body">
                    <div className="ct-card-name">{c.name || '-'}</div>
                    <div className="ct-card-phone-wrap">
                      <span className="ct-card-label">LID:</span> <PhoneDisplay phone={c.phone} />
                    </div>
                    <div className="ct-card-phone-wrap">
                      <span className="ct-card-label">No WA:</span>{' '}
                      {c.manual_wa_number
                        ? <span className="ct-phone">{c.manual_wa_number}</span>
                        : <span className="ct-no-wa">—</span>}
                    </div>
                    <div className="ct-card-dates">
                      <span><Calendar size={11} /> {formatDateTime(c.first_seen)}</span>
                      <span><Clock size={11} /> {formatDateTime(c.last_message_at)}</span>
                    </div>
                  </div>
                  <button className="ct-edit-btn" title="Edit kontak" onClick={() => setEditTarget(c)}>
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editTarget && (
        <EditContactModal
          contact={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`
        .ct-root { display: flex; flex-direction: column; min-height: 0; height: 100%; background: #f0f3fa; overflow: hidden; }
        .ct-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 28px; background: #fff; border-bottom: 1px solid #e4eaf5; flex-shrink: 0; flex-wrap: wrap; }
        .ct-header-left { display: flex; align-items: center; gap: 12px; }
        .ct-header-icon { width: 42px; height: 42px; border-radius: 12px; background: rgba(53,99,233,0.09); color: #3563e9; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ct-title { font-size: 17px; font-weight: 700; color: #1a2540; }
        .ct-sub { font-size: 12px; color: #a8b8d0; margin-top: 1px; }
        .ct-search-wrap { position: relative; }
        .ct-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #a8b8d0; pointer-events: none; }
        .ct-search { background: #f7f9fd; border: 1.5px solid #e4eaf5; border-radius: 10px; padding: 9px 14px 9px 34px; font-size: 13px; color: #1a2540; outline: none; width: 240px; transition: border-color 0.15s; font-family: inherit; }
        .ct-search:focus { border-color: #3563e9; background: #fff; }
        .ct-search::placeholder { color: #b8c8d8; }
        .ct-body { flex: 1; overflow-y: auto; padding: 20px 28px; min-height: 0; }
        .ct-error { background: rgba(229,62,62,0.06); border: 1px solid rgba(229,62,62,0.15); color: #c44; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
        .ct-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; color: #a8b8d0; }
        .ct-empty p { font-size: 14px; }
        .ct-skel-list { display: flex; flex-direction: column; gap: 8px; }
        .ct-skel-row { height: 52px; border-radius: 10px; background: rgba(0,0,0,0.05); animation: ct-pulse 1.4s ease infinite; }
        /* Desktop table */
        .ct-table-wrap { background: #fff; border-radius: 14px; border: 1px solid #e4eaf5; overflow: hidden; box-shadow: 0 1px 4px rgba(26,37,64,0.04); overflow-x: auto; }
        .ct-table { width: 100%; border-collapse: collapse; }
        .ct-table thead tr { background: #f7f9fd; border-bottom: 1px solid #e4eaf5; }
        .ct-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #8a9bb8; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .ct-table tbody tr { border-bottom: 1px solid #f0f3fa; transition: background 0.1s; }
        .ct-table tbody tr:last-child { border-bottom: none; }
        .ct-table tbody tr:hover { background: #f7f9fd; }
        .ct-table td { padding: 13px 16px; vertical-align: middle; }
        .ct-name-cell { display: flex; align-items: center; gap: 10px; }
        .ct-name { font-size: 14px; font-weight: 600; color: #1a2540; }
        .ct-phone { font-size: 13px; color: #4f607a; font-family: monospace; background: #f0f3fa; padding: 3px 8px; border-radius: 6px; }
        .ct-phone-hidden { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #a8b8d0; font-style: italic; }
        .ct-no-wa { font-size: 13px; color: #c4cee0; }
        .ct-date { font-size: 12px; color: #6878a0; }
        .ct-edit-btn { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; transition: all 0.15s; flex-shrink: 0; }
        .ct-edit-btn:hover { background: rgba(53,99,233,0.08); color: #3563e9; }
        /* Mobile card list (hidden on desktop) */
        .ct-card-list { display: none; flex-direction: column; gap: 8px; }
        .ct-card { background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; padding: 14px; display: flex; align-items: flex-start; gap: 12px; }
        .ct-card-body { flex: 1; min-width: 0; }
        .ct-card-name { font-size: 14px; font-weight: 600; color: #1a2540; margin-bottom: 4px; }
        .ct-card-phone-wrap { font-size: 12px; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .ct-card-label { color: #a8b8d0; font-weight: 600; font-size: 11px; }
        .ct-card-phone-wrap .ct-phone { font-size: 12px; color: #4f607a; font-family: monospace; }
        .ct-card-phone-wrap .ct-phone-hidden { font-size: 11px; }
        .ct-card-dates { display: flex; flex-direction: column; gap: 3px; margin-top: 6px; }
        .ct-card-dates span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #8a9bb8; }
        @media (max-width: 768px) {
          .ct-header { padding: 14px 16px; }
          .ct-search { width: 180px; }
          .ct-body { padding: 14px 16px; }
          .ct-table-wrap { display: none; }
          .ct-card-list { display: flex; }
        }
        @keyframes ct-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        /* Edit modal */
        .ct-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .ct-modal { background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
        .ct-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e4eaf5; background: #f7f9fd; }
        .ct-modal-header h3 { font-size: 15px; font-weight: 700; color: #1a2540; }
        .ct-modal-close { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #a8b8d0; }
        .ct-modal-close:hover { background: #e4eaf5; color: #4f607a; }
        .ct-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .ct-field { display: flex; flex-direction: column; gap: 5px; }
        .ct-field label { font-size: 12px; color: #4f607a; font-weight: 600; }
        .ct-field input { background: #f7f9fd; border: 1.5px solid #e4eaf5; border-radius: 8px; color: #1a2540; padding: 10px 12px; font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
        .ct-field input:focus { border-color: #3563e9; background: #fff; }
        .ct-field-hint { font-size: 11px; color: #a8b8d0; }
        .ct-form-err { padding: 10px 14px; background: rgba(229,62,62,0.06); border: 1px solid rgba(229,62,62,0.15); border-radius: 7px; color: #c44; font-size: 13px; }
        .ct-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .ct-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; transition: all 0.15s; }
        .ct-btn.primary { background: #3563e9; color: #fff; }
        .ct-btn.primary:hover { background: #2850cc; }
        .ct-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .ct-btn.secondary { background: #f0f3fa; color: #4f607a; }
        .ct-btn.secondary:hover { background: #e4eaf5; }
      `}</style>
    </div>
  )
}

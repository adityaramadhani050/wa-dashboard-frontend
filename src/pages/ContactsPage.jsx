import { useState, useEffect } from 'react'
import { getContacts, updateContact, bulkSetContactRegion } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { Search, Users, EyeOff, Pencil, X, MapPin, SearchX, ChevronDown } from 'lucide-react'

const REGION_LABEL = { barat: 'Barat', timur: 'Timur' }
const REGION_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'barat', label: 'Barat' },
  { key: 'timur', label: 'Timur' },
  { key: 'none', label: 'Belum diatur', short: 'Belum' },
]

function RegionBadge({ region }) {
  if (!region) return <span className="ct-region none">Belum diatur</span>
  return <span className={`ct-region ${region}`}><MapPin size={11} />{REGION_LABEL[region] || region}</span>
}

function locationText(c) {
  return [c.city, c.province].filter(Boolean).join(', ')
}

const PAGE = 100 // jumlah kontak yang dirender per tahap (daftar bisa ribuan)

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Waktu ringkas: Hari ini 14.05 · Kemarin · 3 hari lalu · 7 Okt 2026
function formatWhen(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= today) return `Hari ini ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
  if (t >= today - 86400000) return 'Kemarin'
  const days = Math.ceil((today - t) / 86400000)
  if (days < 7) return `${days} hari lalu`
  return formatDateTime(dateStr)
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
    return <span className="ct-phone-hidden" title="WhatsApp menyembunyikan nomor asli kontak ini (LID)"><EyeOff size={12} />Tersembunyi</span>
  }
  return <span className="ct-phone">{cleanPhone(phone)}</span>
}

function Avatar({ name, size = 36 }) {
  const letter = (name || '?')[0].toUpperCase()
  const colors = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
  const idx = letter.charCodeAt(0) % colors.length
  return (
    <div className="ct-avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: colors[idx] + '22', color: colors[idx] }}>{letter}</div>
  )
}

const contactName = (c) => c.name || null

function EditContactModal({ contact, onClose, onSaved, isAdmin }) {
  const [name, setName] = useState(contact.name || '')
  const [manualWa, setManualWa] = useState(contact.manual_wa_number || '')
  const [city, setCity] = useState(contact.city || '')
  const [region, setRegion] = useState(contact.region || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { name, manual_wa_number: manualWa }
      if (isAdmin) {
        if ((contact.region || '') !== region) payload.region = region || null
        if ((contact.city || '') !== city) payload.city = city
      }
      const updated = await updateContact(contact.id, payload)
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
          {isAdmin && (
            <>
              <div className="ct-field">
                <label>Kota / Kabupaten</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Contoh: Malang" />
              </div>
              <div className="ct-field">
                <label>Regional</label>
                <select value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="">— Belum diatur</option>
                  <option value="barat">Barat</option>
                  <option value="timur">Timur</option>
                </select>
                <span className="ct-field-hint">Chat kontak ini berikutnya diarahkan ke agent regional tsb.</span>
              </div>
            </>
          )}
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
  const [regionFilter, setRegionFilter] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => { setLimit(PAGE) }, [search, regionFilter])
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

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

  const regionCounts = contacts.reduce((acc, c) => {
    acc[c.region || 'none'] = (acc[c.region || 'none'] || 0) + 1
    return acc
  }, {})

  const filtered = contacts.filter(c => {
    if (regionFilter === 'none' ? !!c.region : regionFilter !== 'all' && c.region !== regionFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const phone = cleanPhone(c.phone) || ''
    return (
      c.name?.toLowerCase().includes(q) ||
      phone.includes(q) ||
      c.manual_wa_number?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.province?.toLowerCase().includes(q)
    )
  })

  // ── Pilih banyak & ubah regional sekaligus (admin) ──
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))
  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAllFiltered = () => setSelected(prev => {
    const next = new Set(prev)
    if (allFilteredSelected) filtered.forEach(c => next.delete(c.id))
    else filtered.forEach(c => next.add(c.id))
    return next
  })
  const applyBulkRegion = async (region) => {
    if (!selected.size || bulkBusy) return
    const label = region ? `Regional ${REGION_LABEL[region]}` : 'tanpa regional'
    if (!window.confirm(`Ubah ${selected.size} kontak menjadi ${label}?`)) return
    setBulkBusy(true)
    try {
      const ids = [...selected]
      await bulkSetContactRegion(ids, region)
      const idSet = new Set(ids)
      setContacts(prev => prev.map(c => idSet.has(c.id) ? { ...c, region } : c))
      setSelected(new Set())
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal mengubah regional kontak. Pastikan SQL migrasi regional sudah dijalankan.')
    } finally { setBulkBusy(false) }
  }

  const shown = filtered.slice(0, limit)
  const hasFilter = !!search.trim() || regionFilter !== 'all'

  return (
    <div className="ct-root">
      <div className="ct-page">
        {/* Header */}
        <div className="ct-header">
          <h1 className="ct-title"><Users size={21} />Kontak{!loading && <span className="ct-count" title={`${contacts.length} kontak terdaftar`}>{contacts.length.toLocaleString('id-ID')}</span>}</h1>
        </div>

        {error && <div className="ct-error">{error}</div>}

        {/* Pencarian & filter regional */}
        <div className="ct-toolbar">
          <div className="ct-search-wrap">
            <Search size={15} className="ct-search-icon" />
            <input
              className="ct-search"
              placeholder="Cari nama, nomor, atau kota…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="ct-search-clear" onClick={() => setSearch('')} aria-label="Hapus pencarian"><X size={14} /></button>}
          </div>
          <div className="ct-seg">
            {REGION_FILTERS.map(f => (
              <button key={f.key} className={`${regionFilter === f.key ? 'active' : ''} ${f.key}`} onClick={() => setRegionFilter(f.key)}>
                <span className="ct-seg-full">{f.label}</span><span className="ct-seg-short">{f.short || f.label}</span>
                <span className="ct-seg-count">{(f.key === 'all' ? contacts.length : (regionCounts[f.key] || 0)).toLocaleString('id-ID')}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="ct-skel-list">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="ct-skel-row" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="ct-skel-av" /><span className="ct-skel-lines"><i /><i /></span>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ct-empty">
            {hasFilter ? <SearchX size={36} strokeWidth={1.4} /> : <Users size={36} strokeWidth={1.4} />}
            <p>{hasFilter ? 'Tidak ada kontak yang cocok.' : 'Belum ada kontak.'}</p>
            {hasFilter && <button className="ct-reset" onClick={() => { setSearch(''); setRegionFilter('all') }}>Reset filter</button>}
          </div>
        ) : (
          <>
            {/* Tabel (desktop) */}
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className="ct-check-col">
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} title="Pilih semua yang cocok dengan filter" />
                      </th>
                    )}
                    <th>Kontak</th>
                    <th title="ID dari WhatsApp; bisa tersembunyi (LID)">ID WhatsApp</th>
                    <th>No WA</th>
                    <th>Regional</th>
                    <th>Pertama chat</th>
                    <th>Terakhir chat</th>
                    <th className="ct-act-col" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(c => (
                    <tr key={c.id} className={selected.has(c.id) ? 'selected' : ''}>
                      {isAdmin && (
                        <td className="ct-check-col">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                        </td>
                      )}
                      <td>
                        <div className="ct-name-cell">
                          <Avatar name={contactName(c) || cleanPhone(c.phone) || c.manual_wa_number} />
                          <div className="ct-name-info">
                            {contactName(c) ? <span className="ct-name">{c.name}</span> : <span className="ct-name noname">Tanpa nama</span>}
                            {locationText(c) && <span className="ct-sub"><MapPin size={11} />{locationText(c)}</span>}
                          </div>
                        </div>
                      </td>
                      <td><PhoneDisplay phone={c.phone} /></td>
                      <td>{c.manual_wa_number ? <span className="ct-phone">{c.manual_wa_number}</span> : <span className="ct-no-wa">—</span>}</td>
                      <td><RegionBadge region={c.region} /></td>
                      <td><span className="ct-date">{formatDateTime(c.first_seen)}</span></td>
                      <td><span className="ct-date strong">{formatWhen(c.last_message_at)}</span></td>
                      <td className="ct-act-col">
                        <button className="ct-edit-btn" title="Edit kontak" aria-label="Edit kontak" onClick={() => setEditTarget(c)}>
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu (HP) */}
            <div className="ct-card-list">
              {shown.map(c => (
                <div key={c.id} className="ct-card">
                  <Avatar name={contactName(c) || cleanPhone(c.phone) || c.manual_wa_number} size={40} />
                  <div className="ct-card-body">
                    <div className="ct-card-top">
                      {contactName(c) ? <span className="ct-name">{c.name}</span> : <span className="ct-name noname">Tanpa nama</span>}
                      <span className="ct-card-when">{formatWhen(c.last_message_at)}</span>
                    </div>
                    <div className="ct-card-line">
                      {c.manual_wa_number ? <span className="ct-phone">{c.manual_wa_number}</span> : <PhoneDisplay phone={c.phone} />}
                    </div>
                    <div className="ct-card-line">
                      <RegionBadge region={c.region} />
                      {locationText(c) && <span className="ct-sub">{locationText(c)}</span>}
                    </div>
                  </div>
                  <button className="ct-edit-btn" title="Edit kontak" aria-label="Edit kontak" onClick={() => setEditTarget(c)}>
                    <Pencil size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="ct-more">
              <span>Menampilkan {shown.length.toLocaleString('id-ID')} dari {filtered.length.toLocaleString('id-ID')} kontak</span>
              {filtered.length > shown.length && (
                <button onClick={() => setLimit(l => l + PAGE)}><ChevronDown size={15} /> Tampilkan {Math.min(PAGE, filtered.length - shown.length)} lagi</button>
              )}
            </div>
          </>
        )}

        {/* Aksi massal (admin): bar mengambang */}
        {isAdmin && selected.size > 0 && (
          <div className="ct-bulk">
            <span className="ct-bulk-count">{selected.size.toLocaleString('id-ID')} dipilih</span>
            <span className="ct-bulk-sep" />
            <span className="ct-bulk-lbl">Ubah regional:</span>
            <button className="ct-bulk-btn barat" disabled={bulkBusy} onClick={() => applyBulkRegion('barat')}>Barat</button>
            <button className="ct-bulk-btn timur" disabled={bulkBusy} onClick={() => applyBulkRegion('timur')}>Timur</button>
            <button className="ct-bulk-btn" disabled={bulkBusy} onClick={() => applyBulkRegion(null)}>Kosongkan</button>
            <button className="ct-bulk-x" disabled={bulkBusy} onClick={() => setSelected(new Set())} aria-label="Batalkan pilihan"><X size={16} /></button>
          </div>
        )}
      </div>

      {editTarget && (
        <EditContactModal
          contact={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
          isAdmin={isAdmin}
        />
      )}

      <style>{`
        .ct-root { height: 100%; min-height: 0; overflow-y: auto; background: var(--bg); }
        .ct-page { padding: 24px 24px 40px; width: 100%; color: var(--text); }
        .ct-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
        .ct-title { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; color: var(--text); }
        .ct-count { font-size: 11.5px; font-weight: 700; color: var(--text2); background: var(--surface); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
        .ct-seg-short { display: none; }
        .ct-error { background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.3); color: var(--danger); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }

        .ct-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .ct-search-wrap { position: relative; flex: 1 1 280px; max-width: 420px; }
        .ct-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
        .ct-search { width: 100%; height: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0 36px 0 36px; font-size: 13.5px; color: var(--text); outline: none; transition: border-color 0.15s; font-family: inherit; }
        .ct-search:focus { border-color: var(--primary); }
        .ct-search::placeholder { color: var(--muted); }
        .ct-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .ct-search-clear:hover { background: var(--surface3); color: var(--text); }
        .ct-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); margin-left: auto; }
        .ct-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
        .ct-seg button:hover:not(.active) { background: var(--surface3); }
        .ct-seg button.active { background: var(--primary); color: var(--on-primary); }
        .ct-seg button.active.barat { background: #2563eb; } .ct-seg button.active.timur { background: #d97706; }
        .ct-seg-count { font-size: 11px; font-weight: 700; padding: 0 6px; border-radius: 999px; background: var(--surface3); color: var(--text2); }
        .ct-seg button.active .ct-seg-count { background: rgba(255,255,255,0.25); color: var(--on-primary); }

        .ct-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 0; color: var(--muted); font-size: 13.5px; }
        .ct-reset { padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--primary); background: var(--primary-light); }
        .ct-skel-list { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .ct-skel-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); animation: ct-pulse 1.4s ease infinite; }
        .ct-skel-av { width: 36px; height: 36px; border-radius: 50%; background: var(--skeleton); flex-shrink: 0; }
        .ct-skel-lines { flex: 1; display: flex; flex-direction: column; gap: 7px; }
        .ct-skel-lines i { display: block; height: 10px; border-radius: 5px; background: var(--skeleton); width: 30%; }
        .ct-skel-lines i:last-child { width: 55%; }

        .ct-avatar { border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        /* Tabel */
        .ct-table-wrap { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px var(--shadow); overflow-x: auto; }
        .ct-table { width: 100%; border-collapse: collapse; }
        .ct-table thead tr { background: var(--surface2); border-bottom: 1px solid var(--border); }
        .ct-table th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .ct-table tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .ct-table tbody tr:last-child { border-bottom: none; }
        .ct-table tbody tr:hover { background: var(--surface2); }
        .ct-table tbody tr.selected { background: var(--primary-light); }
        .ct-table td { padding: 10px 14px; vertical-align: middle; }
        .ct-name-cell { display: flex; align-items: center; gap: 11px; min-width: 220px; }
        .ct-name-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ct-name { font-size: 14px; font-weight: 600; color: var(--text); }
        .ct-name.noname { color: var(--muted); font-weight: 500; font-style: italic; }
        .ct-sub { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); }
        .ct-phone { font-size: 13px; color: var(--text2); font-variant-numeric: tabular-nums; letter-spacing: 0.2px; white-space: nowrap; }
        .ct-phone-hidden { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); white-space: nowrap; }
        .ct-no-wa { font-size: 13px; color: var(--muted); }
        .ct-date { font-size: 12.5px; color: var(--muted); white-space: nowrap; }
        .ct-date.strong { color: var(--text2); }
        .ct-check-col { width: 44px; padding-right: 0 !important; }
        .ct-check-col input { width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; vertical-align: middle; }
        .ct-act-col { width: 52px; text-align: right; }
        .ct-region { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .ct-region.barat { color: #2563eb; background: rgba(37,99,235,0.12); }
        .ct-region.timur { color: #d97706; background: rgba(217,119,6,0.13); }
        .ct-region.none { color: var(--muted); background: var(--surface3); font-weight: 600; }
        @media (prefers-color-scheme: dark) { .ct-region.barat { color: #7aa7ff; background: rgba(91,140,255,0.16); } .ct-region.timur { color: #f0a94a; } }
        .ct-edit-btn { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; flex-shrink: 0; }
        .ct-edit-btn:hover { background: var(--primary-light); color: var(--primary); }
        .ct-more { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 12px; font-size: 12.5px; color: var(--muted); }
        .ct-more button { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--primary); background: var(--surface); border: 1px solid var(--border); }
        .ct-more button:hover { background: var(--primary-light); }

        /* Bar aksi massal mengambang */
        .ct-bulk { position: sticky; bottom: 16px; z-index: 20; margin: 14px auto 0; width: fit-content; max-width: 100%; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 8px 8px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border2); box-shadow: 0 12px 32px var(--shadow), 0 2px 8px var(--shadow); animation: ct-up 0.16s ease-out; }
        @keyframes ct-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .ct-bulk-count { font-size: 13px; font-weight: 700; color: var(--primary); }
        .ct-bulk-sep { width: 1px; height: 20px; background: var(--border); }
        .ct-bulk-lbl { font-size: 12.5px; color: var(--muted); }
        .ct-bulk-btn { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .ct-bulk-btn:hover:not(:disabled) { border-color: var(--border2); }
        .ct-bulk-btn.barat { color: #3b82f6; border-color: rgba(37,99,235,0.4); }
        .ct-bulk-btn.timur { color: #d97706; border-color: rgba(217,119,6,0.4); }
        .ct-bulk-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ct-bulk-x { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .ct-bulk-x:hover { background: var(--surface3); color: var(--text); }

        /* Kartu (HP) */
        .ct-card-list { display: none; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .ct-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px 10px 12px 14px; border-bottom: 1px solid var(--border); }
        .ct-card:last-child { border-bottom: none; }
        .ct-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .ct-card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .ct-card-top .ct-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ct-card-when { font-size: 11.5px; color: var(--muted); white-space: nowrap; flex-shrink: 0; }
        .ct-card-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
        @media (max-width: 768px) {
          .ct-page { padding: 16px 14px 28px; }
          .ct-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .ct-search-wrap { max-width: none; flex: none; }
          .ct-seg { margin-left: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .ct-seg button { padding: 0 4px; gap: 4px; font-size: 12px; }
          .ct-seg-count { padding: 0 5px; font-size: 10.5px; }
          .ct-seg-full { display: none; } .ct-seg-short { display: inline; }
          .ct-table-wrap { display: none; }
          .ct-card-list { display: flex; }
          .ct-bulk { display: none; }
        }
        @media (max-width: 380px) { .ct-seg button .ct-seg-count { display: none; } }
        @keyframes ct-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        /* Modal edit */
        .ct-overlay { position: fixed; inset: 0; z-index: 500; background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ct-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; max-height: calc(100vh - 32px); overflow-y: auto; }
        .ct-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
        .ct-modal-header h3 { font-size: 15px; font-weight: 700; color: var(--text); }
        .ct-modal-close { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .ct-modal-close:hover { background: var(--surface3); color: var(--text2); }
        .ct-form { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
        .ct-field { display: flex; flex-direction: column; gap: 6px; }
        .ct-field label { font-size: 12px; color: var(--text2); font-weight: 600; }
        .ct-field input, .ct-field select { height: 40px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); padding: 0 12px; font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
        .ct-field input:focus, .ct-field select:focus { border-color: var(--primary); background: var(--surface); }
        .ct-field-hint { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
        .ct-form-err { padding: 10px 14px; background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.25); border-radius: 9px; color: var(--danger); font-size: 13px; }
        .ct-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
        .ct-btn { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 18px; border-radius: 9px; font-size: 13px; font-weight: 600; transition: all 0.15s; }
        .ct-btn.primary { background: var(--primary); color: var(--on-primary); }
        .ct-btn.primary:hover { background: var(--primary-hover); }
        .ct-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .ct-btn.secondary { background: var(--surface3); color: var(--text2); }
      `}</style>
    </div>
  )
}

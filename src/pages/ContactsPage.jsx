import { useState, useEffect } from 'react'
import { getContacts } from '../hooks/useApi'
import { Search, Users, Phone, Calendar, Clock } from 'lucide-react'

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })
}

function cleanPhone(phone) {
  return phone ? phone.split('@')[0] : '-'
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getContacts()
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(() => setError('Gagal memuat kontak.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      cleanPhone(c.phone).includes(q)
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
                    <th><Phone size={13} style={{marginRight:4,verticalAlign:'middle'}}/>Nomor WA</th>
                    <th><Calendar size={13} style={{marginRight:4,verticalAlign:'middle'}}/>Pertama Chat</th>
                    <th><Clock size={13} style={{marginRight:4,verticalAlign:'middle'}}/>Terakhir Chat</th>
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
                      <td><span className="ct-phone">{cleanPhone(c.phone)}</span></td>
                      <td><span className="ct-date">{formatDateTime(c.first_seen)}</span></td>
                      <td><span className="ct-date">{formatDateTime(c.last_message_at)}</span></td>
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
                    <div className="ct-card-phone">{cleanPhone(c.phone)}</div>
                    <div className="ct-card-dates">
                      <span><Calendar size={11} /> {formatDateTime(c.first_seen)}</span>
                      <span><Clock size={11} /> {formatDateTime(c.last_message_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

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
        .ct-table-wrap { background: #fff; border-radius: 14px; border: 1px solid #e4eaf5; overflow: hidden; box-shadow: 0 1px 4px rgba(26,37,64,0.04); }
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
        .ct-date { font-size: 12px; color: #6878a0; }
        /* Mobile card list (hidden on desktop) */
        .ct-card-list { display: none; flex-direction: column; gap: 8px; }
        .ct-card { background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; padding: 14px; display: flex; align-items: flex-start; gap: 12px; }
        .ct-card-body { flex: 1; min-width: 0; }
        .ct-card-name { font-size: 14px; font-weight: 600; color: #1a2540; margin-bottom: 2px; }
        .ct-card-phone { font-size: 12px; color: #4f607a; font-family: monospace; margin-bottom: 6px; }
        .ct-card-dates { display: flex; flex-direction: column; gap: 3px; }
        .ct-card-dates span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #8a9bb8; }
        @media (max-width: 768px) {
          .ct-header { padding: 14px 16px; }
          .ct-search { width: 180px; }
          .ct-body { padding: 14px 16px; }
          .ct-table-wrap { display: none; }
          .ct-card-list { display: flex; }
        }
        @keyframes ct-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

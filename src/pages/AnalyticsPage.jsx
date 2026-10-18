import { useState, useEffect, useCallback, useRef } from 'react'
import { getDailyStats, getAgentStats, getAnalyticsSummary, getContacts, getConversations, getTopTemplates, getResponseKpi, getFunnel, getFollowupReport } from '../hooks/useApi'
import FollowupReport from '../components/FollowupReport'
import { formatDurShort, formatDurLong } from '../lib/duration'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { RefreshCw, TrendingUp, Users, MessageSquare, UserCheck, Clock, UserPlus, Calendar, Download, Zap, MapPin, ChevronDown, Activity, BarChart2, Inbox, CheckCircle2, Info, UserX, Trophy } from 'lucide-react'

const REGION_OPTIONS = [
  { key: '', label: 'Semua' },
  { key: 'barat', label: 'Barat' },
  { key: 'timur', label: 'Timur' },
]

// Tanggal lokal (WIB di perangkat user) dalam format YYYY-MM-DD.
// Jangan pakai toISOString(): itu UTC, sehingga 00.00–07.00 WIB jadi "kemarin".
function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// "16 Okt 2026" atau "3 – 16 Okt 2026"
function fmtRange(from, to) {
  if (!from || !to) return ''
  const f = new Date(`${from}T00:00:00`), t = new Date(`${to}T00:00:00`)
  const full = { day: 'numeric', month: 'short', year: 'numeric' }
  if (from === to) return t.toLocaleDateString('id-ID', full)
  const sameYear = f.getFullYear() === t.getFullYear()
  const sameMonth = sameYear && f.getMonth() === t.getMonth()
  const left = f.toLocaleDateString('id-ID', sameMonth ? { day: 'numeric' } : sameYear ? { day: 'numeric', month: 'short' } : full)
  return `${left} – ${t.toLocaleDateString('id-ID', full)}`
}

const AGENT_NUM_COLS = ['new', 'old', 'active', 'resolved', 'total', 'prospek', 'deal']

const PRESETS = [
  { days: 1, label: 'Hari ini' },
  { days: 7, label: '7 hari' },
  { days: 14, label: '14 hari' },
  { days: 30, label: '30 hari' },
]

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escapeCell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCell(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StatCard({ icon: Icon, label, value, sub, color, loading, title }) {
  return (
    <div className="an-stat" title={title}>
      <div className="an-stat-top">
        <span className="an-stat-lbl">{label}</span>
        <span className="an-stat-icon" style={{ background: `${color}1f`, color }}><Icon size={16} /></span>
      </div>
      {loading ? <div className="an-stat-skel" /> : <div className="an-stat-val">{value ?? '—'}</div>}
      {sub != null && !loading && <div className="an-stat-sub">{sub}</div>}
    </div>
  )
}

// Satu tahap konversi: label + bar + persen (num/den). den 0 -> "—".
function ConvStep({ label, num = 0, den = 0, title, tone = 'primary' }) {
  const pct = den ? Math.round((num / den) * 100) : null
  return (
    <div className="an-conv-step" title={title}>
      <span className="an-conv-lbl">{label}</span>
      <div className="an-rate-bar"><div className={`an-rate-fill ${tone}`} style={{ width: `${pct ?? 0}%` }} /></div>
      <span className="an-conv-pct">{pct == null ? '—' : `${pct}%`}</span>
    </div>
  )
}

// Judul bagian yang seragam (ikon + judul + keterangan kanan)
function SectionHead({ icon: Icon, title, right }) {
  return (
    <div className="an-sec-head">
      <h3>{Icon && <Icon size={15} />}{title}</h3>
      {right && <span className="an-sec-right">{right}</span>}
    </div>
  )
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="an-tip">
      <p className="an-tip-lbl">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const defaultTo = fmtDate(new Date())
  const defaultFrom = fmtDate(new Date()) // default: hari ini

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [daily, setDaily] = useState([])
  const [agents, setAgents] = useState([])
  const [summary, setSummary] = useState(null)
  const [topTemplates, setTopTemplates] = useState([])
  const [kpi, setKpi] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [fuReport, setFuReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  // Filter regional ('' = semua). Disimpan juga di ref agar semua pemanggilan load() ikut.
  const [region, setRegion] = useState('')
  const regionRef = useRef('')
  const [preset, setPreset] = useState(1) // 1/7/14/30 hari; null = rentang manual
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef(null)
  useEffect(() => {
    if (!showExport) return
    const onDown = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showExport])

  const load = useCallback(async (f, t) => {
    setLoading(true)
    setError('')
    const r = regionRef.current || undefined
    try {
      const [d, a, sm, tpl, k, fn, fr] = await Promise.all([
        getDailyStats(f, t, r), getAgentStats(f, t, r), getAnalyticsSummary(f, t, r).catch(() => null),
        getTopTemplates(5).catch(() => []),
        getResponseKpi(f, t, r).catch(() => null),
        getFunnel(f, t, r).catch(() => null),
        getFollowupReport(f, t, r).catch(() => null),
      ])
      setDaily(Array.isArray(d) ? d : [])
      setAgents(Array.isArray(a) ? a : [])
      setSummary(sm || null)
      setTopTemplates(Array.isArray(tpl) ? tpl : [])
      setKpi(k || null)
      setFunnel(fn || null)
      setFuReport(fr?.totals ? fr : null)
    } catch {
      setError('Gagal memuat analytics. Cek koneksi backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExportContacts = async () => {
    setExporting('contacts')
    try {
      const data = await getContacts()
      const rows = (data || []).map(c => ({
        nama: c.name || '',
        telepon: c.phone || '',
        no_wa_manual: c.manual_wa_number || '',
        kota: c.city || '',
        provinsi: c.province || '',
        regional: c.region ? (c.region === 'barat' ? 'Barat' : 'Timur') : '',
        pertama_dilihat: c.first_seen || '',
        pesan_terakhir: c.last_message_at || '',
      }))
      downloadCsv(`kontak-${fmtDate(new Date())}.csv`, rows)
    } catch {
      setError('Gagal mengekspor kontak.')
    } finally {
      setExporting('')
    }
  }

  const handleExportConversations = async () => {
    setExporting('conversations')
    try {
      const data = await getConversations()
      const rows = (data || []).map(c => ({
        kontak: c.contact?.name || c.contact?.phone || '',
        status: c.status || '',
        agent: c.agents?.name || '',
        pesan_terakhir: c.lastMessage || '',
        diperbarui: c.updated_at || '',
      }))
      downloadCsv(`percakapan-${fmtDate(new Date())}.csv`, rows)
    } catch {
      setError('Gagal mengekspor percakapan.')
    } finally {
      setExporting('')
    }
  }

  useEffect(() => { load(from, to) }, []) // eslint-disable-line

  const handleApply = () => { if (from && to) { setPreset(null); load(from, to) } }
  const handlePreset = (days) => {
    const t = fmtDate(new Date())
    const f = fmtDate(new Date(Date.now() - (days - 1) * 86400000))
    setFrom(f); setTo(t); setPreset(days)
    load(f, t)
  }
  const rangeLabel = fmtRange(from, to)

  const kpiMinutes = kpi?.kpiMinutes ?? 5
  const sumOr = (key) => summary?.[key] ?? null
  const chartData = daily.map(d => ({
    date: new Date(`${d.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    Masuk: d.incoming || 0,
    Keluar: d.outgoing || 0,
    'Lead Baru': d.new_contacts || 0,
  }))

  const agentChart = agents.map(a => ({
    name: a.name || 'Agent',
    'Total Lead': a.total_leads || 0,
    Prospek: a.prospek || 0,
    Deal: a.deal || 0,
  }))

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <h1><BarChart2 size={21} />Analytics</h1>
        <div className="an-header-actions">
          <div className="an-dd" ref={exportRef}>
            <button className="an-btn" onClick={() => setShowExport(v => !v)} disabled={!!exporting}>
              <Download size={15} />
              <span>{exporting ? 'Mengekspor…' : 'Export'}</span>
              <ChevronDown size={14} />
            </button>
            {showExport && (
              <div className="an-menu">
                <button onClick={() => { setShowExport(false); handleExportContacts() }}><UserPlus size={14} /> Kontak (CSV)</button>
                <button onClick={() => { setShowExport(false); handleExportConversations() }}><MessageSquare size={14} /> Percakapan (CSV)</button>
              </div>
            )}
          </div>
          <button className="an-btn icon" onClick={() => load(from, to)} disabled={loading} title="Muat ulang" aria-label="Muat ulang">
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
      </div>

      {/* Filter: periode, rentang tanggal, regional */}
      <div className="an-filter">
        <div className="an-filter-group">
          <Calendar size={15} className="an-filter-icon" />
          <div className="an-seg">
            {PRESETS.map(p => (
              <button key={p.days} className={preset === p.days ? 'active' : ''} disabled={loading} onClick={() => handlePreset(p.days)}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="an-filter-group">
          <MapPin size={15} className="an-filter-icon" />
          <div className="an-seg">
            {REGION_OPTIONS.map(o => (
              <button
                key={o.key || 'all'}
                className={`${region === o.key ? 'active' : ''}${o.key ? ` ${o.key}` : ''}`}
                disabled={loading}
                onClick={() => { regionRef.current = o.key; setRegion(o.key); load(from, to) }}
              >{o.label}</button>
            ))}
          </div>
        </div>
        <div className="an-date-range">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} aria-label="Dari tanggal" />
          <span>–</span>
          <input type="date" value={to} min={from} max={fmtDate(new Date())} onChange={e => setTo(e.target.value)} aria-label="Sampai tanggal" />
          <button className="an-apply" onClick={handleApply} disabled={loading || !from || !to}>Terapkan</button>
        </div>
      </div>
      <div className="an-range-note">
        Menampilkan data <b>{rangeLabel}</b>{region && <> · Regional <b>{region === 'barat' ? 'Barat' : 'Timur'}</b> (tabel agent hanya agent regional tsb.)</>}
      </div>

      {error && <div className="an-error">{error}</div>}

      {/* Kartu ringkasan (= total tabel agent + chat yang belum di-assign) */}
      <div className="an-cards">
        <StatCard
          loading={loading}
          icon={UserPlus}
          label="Lead Baru"
          value={sumOr('new_contacts')}
          sub={summary ? `${summary.total_contacts.toLocaleString('id-ID')} kontak total` : null}
          title="Kontak yang pertama kali chat dalam periode (tanpa grup & Non-Client)"
          color="#2563eb"
        />
        <StatCard
          loading={loading}
          icon={UserCheck}
          label="Lead Lama"
          value={sumOr('old_chats')}
          sub="customer lama yang dihubungi agent"
          title="Customer lama (kontak sebelum periode, belum Deal) yang dikirimi pesan oleh agent dalam periode"
          color="#6366f1"
        />
        <StatCard
          loading={loading}
          icon={Inbox}
          label="Aktif"
          value={sumOr('active')}
          sub={summary ? (summary.live ? `status saat ini · ${summary.awaiting} menunggu balasan` : 'belum di-resolve sejak periode ini') : null}
          title="Dari Total Lead: hari ini = masih Open/Aktif saat ini; periode lampau = belum pernah di-resolve sejak periode itu"
          color="#8b5cf6"
        />
        <StatCard
          loading={loading}
          icon={CheckCircle2}
          label="Resolved"
          value={sumOr('resolved')}
          sub={summary ? `dari ${summary.total_leads} total lead` : null}
          title="Dari Total Lead: hari ini = sudah Resolved saat ini; periode lampau = sudah di-resolve setelah periode itu (walau kini aktif lagi karena aktivitas baru)"
          color="#10b981"
        />
      </div>
      <div className="an-cards">
        <StatCard
          loading={loading}
          icon={Users}
          label="Total Lead"
          value={sumOr('total_leads')}
          sub={summary ? `${summary.new_contacts} baru · ${summary.old_chats} lama` : null}
          title="Lead Baru + Lead Lama dalam periode"
          color="#0ea5e9"
        />
        <StatCard
          loading={loading}
          icon={UserCheck}
          label="Lead Baru Di-assign"
          value={sumOr('new_assigned')}
          sub={summary ? `${summary.new_contacts ? Math.round((summary.new_assigned / summary.new_contacts) * 100) : 0}% dari ${summary.new_contacts} lead baru` : null}
          title="Lead baru dalam periode yang sudah di-assign ke agent/admin"
          color="#6366f1"
        />
        <StatCard
          loading={loading}
          icon={UserX}
          label="Belum Di-assign"
          value={sumOr('new_unassigned')}
          sub={summary ? (summary.new_unassigned ? 'lead baru perlu di-assign' : 'semua lead baru sudah di-assign') : null}
          title="Lead baru dalam periode yang belum di-assign ke siapa pun"
          color={summary?.new_unassigned ? '#ef4444' : '#64748b'}
        />
        <StatCard
          loading={loading}
          icon={Trophy}
          label="Deal"
          value={sumOr('deal')}
          sub={summary ? `${summary.total_leads ? Math.round((summary.deal / summary.total_leads) * 100) : 0}% dari total lead · ${summary.prospek} prospek` : null}
          title="Total Lead yang diberi tag Deal dalam periode"
          color="#10b981"
        />
      </div>

      {/* Detail per Agent */}
      {!loading && agents.length > 0 && (
        <div className="an-table-box">
          <SectionHead icon={Users} title="Detail per Agent" right={`${agents.length} agent · ${rangeLabel}`} />
          <div className="an-table-wrap">
            <table className="an-table an-agent-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                {AGENT_NUM_COLS.map((c) => <col key={c} style={{ width: '7%' }} />)}
                <col style={{ width: '9%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="num" title="Kontak yang pertama kali chat dalam periode">Lead Baru</th>
                  <th className="num" title="Customer lama (belum Deal) yang dikirimi pesan oleh agent dalam periode">Lead Lama</th>
                  <th className="num" title={summary?.live ? 'Dari Total Lead: masih Open/Aktif saat ini' : 'Dari Total Lead: belum pernah di-resolve sejak periode ini'}>Aktif</th>
                  <th className="num" title={summary?.live ? 'Dari Total Lead: sudah Resolved saat ini' : 'Dari Total Lead: sudah di-resolve setelah periode ini (walau kini aktif lagi)'}>Resolved</th>
                  <th className="num" title="Lead Baru + Lead Lama">Total Lead</th>
                  <th className="num" title="Dari Total Lead: sudah diberi tag Prospek sampai akhir periode (atau langsung Deal)">Prospek</th>
                  <th className="num" title="Dari Total Lead: diberi tag Deal dalam periode">Deal</th>
                  <th className="num" title={`Rata-rata waktu agent membalas pesan customer dalam periode${kpi?.workHours ? ' (dihitung dalam jam kerja)' : ''}`}>Avg. Respons</th>
                  <th title="Lead → Prospek: Prospek ÷ Total Lead. Prospek → Deal: Deal ÷ Prospek.">Konversi</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id || a.name}>
                    <td>
                      <div className="an-agent-cell">
                        <div className="an-avatar">{(a.name || 'A')[0].toUpperCase()}</div>
                        <div className="an-agent-id">
                          <div className="an-agent-name" title={a.name}>{a.name}</div>
                          {a.email && <div className="an-agent-email" title={a.email}>{a.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="num"><span className="an-badge lead">{a.new_contacts || 0}</span></td>
                    <td className="num"><span className="an-badge old">{a.old_chats || 0}</span></td>
                    <td className="num"><span className="an-badge active" title={summary?.live && a.awaiting ? `${a.awaiting} menunggu balasan` : undefined}>{a.active || 0}</span></td>
                    <td className="num"><span className="an-badge resolved">{a.resolved || 0}</span></td>
                    <td className="num"><span className="an-total">{a.total_leads || 0}</span></td>
                    <td className="num"><span className="an-badge prospek">{a.prospek || 0}</span></td>
                    <td className="num"><span className="an-badge deal" title={a.fail ? `${a.fail} Fail` : undefined}>{a.deal || 0}</span></td>
                    <td className="num">
                      {a.avgResponse != null
                        ? <span className={`an-resp${a.avgResponse > kpiMinutes ? ' slow' : ''}`} title={`Rata-rata ${formatDurLong(a.avgResponse)} dari ${a.replies} balasan`}>{formatDurShort(a.avgResponse)}</span>
                        : <span className="an-resp none" title="Belum ada balasan dalam periode">—</span>}
                    </td>
                    <td>
                      <div className="an-conv">
                        <ConvStep label="Lead → Prospek" num={a.prospek} den={a.total_leads}
                          title={`${a.prospek || 0} dari ${a.total_leads || 0} lead sudah Prospek`} />
                        <ConvStep label="Prospek → Deal" num={a.deal} den={a.prospek} tone="deal"
                          title={`${a.deal || 0} dari ${a.prospek || 0} prospek Deal`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary && (!summary.tag_times || !summary.tag_history) && (
            <div className="an-table-note">
              {!summary.tag_times ? (
                <span className="an-note-warn"><Info size={13} /> Waktu pemasangan tag belum tercatat, jadi Prospek/Deal masih perkiraan. Jalankan SQL migrasi tag di Supabase.</span>
              ) : (
                <span className="an-note-warn"><Info size={13} /> Riwayat tag belum aktif: tag yang sudah dilepas (mis. Prospek diganti Deal/Fail) belum ikut terhitung.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Response Time & Funnel */}
      <div className="an-kpi-row">
        <div className="an-kpi-box">
          <SectionHead icon={Clock} title={`KPI Respons ≤ ${kpiMinutes} menit`} right={kpi?.workHours ? 'dihitung dalam jam kerja' : null} />
          {loading ? <div className="an-skel" style={{ height: 120 }} /> : !kpi || (kpi.total === 0 && !kpi.unreplied) ? (
            <div className="an-chart-empty">Belum ada data balasan pada rentang ini</div>
          ) : (
            <>
              <div className="an-kpi-big" style={{ color: kpi.percent >= 80 ? '#10b981' : kpi.percent >= 50 ? '#f59e0b' : '#ef4444' }}>
                {kpi.percent}%
              </div>
              <div className="an-kpi-sub">
                {kpi.met} dari {kpi.total} pesan customer dibalas agent ≤{kpiMinutes} menit
                {kpi.unreplied > 0 && <span className="an-kpi-wait"> · {kpi.unreplied} masih menunggu balasan</span>}
              </div>
              {kpi.agents?.length > 0 && (
                <div className="an-kpi-agents">
                  {kpi.agents.map(a => (
                    <div key={a.agent_id || 'unassigned'} className="an-kpi-agent-row">
                      <span className="an-kpi-agent-name">{a.name}</span>
                      <div className="an-kpi-bar"><div className="an-kpi-bar-fill" style={{ width: `${a.percent}%`, background: a.percent >= 80 ? '#10b981' : a.percent >= 50 ? '#f59e0b' : '#ef4444' }} /></div>
                      <span className="an-kpi-agent-pct" title={a.unreplied ? `${a.unreplied} menunggu balasan` : undefined}>{a.percent}% <span style={{ color: 'var(--muted)' }}>({a.met}/{a.total})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="an-kpi-box">
          <SectionHead icon={TrendingUp} title="Funnel Konversi" right="dari Total Lead" />
          {loading ? <div className="an-skel" style={{ height: 120 }} /> : !funnel?.conversion ? (
            <div className="an-chart-empty">Belum ada data funnel</div>
          ) : (
            <div className="an-funnel">
              {funnel.stages.map((s, i) => {
                const base = funnel.stages[0]?.count || 0
                const pct = base ? Math.round((s.count / base) * 100) : null
                const colors = ['#2563eb', '#6366f1', '#10b981']
                return (
                  <div key={s.stage} className="an-funnel-row">
                    <span className="an-funnel-lbl">{s.stage}</span>
                    <div className="an-funnel-bar-wrap">
                      <div className="an-funnel-bar" style={{ width: `${Math.max(pct ?? 0, 3)}%`, background: colors[i % colors.length] }}>
                        <span className="an-funnel-count">{s.count}</span>
                      </div>
                    </div>
                    <span className="an-funnel-pct">{pct == null ? '—' : `${pct}%`}</span>
                  </div>
                )
              })}
              {funnel.fail > 0 && (
                <div className="an-funnel-fail">Gagal/Batal (Fail): <strong>{funnel.fail}</strong></div>
              )}
              <div className="an-conv-total">
                <div className="an-conv-head">Tingkat konversi</div>
                <ConvStep label="Lead → Prospek" num={funnel.conversion.prospek} den={funnel.conversion.lead}
                  title={`${funnel.conversion.prospek} dari ${funnel.conversion.lead} lead sudah Prospek`} />
                <ConvStep label="Prospek → Deal" num={funnel.conversion.deal} den={funnel.conversion.prospek} tone="deal"
                  title={`${funnel.conversion.deal} dari ${funnel.conversion.prospek} prospek Deal`} />
                <ConvStep label="Lead → Deal" num={funnel.conversion.deal} den={funnel.conversion.lead} tone="deal"
                  title={`${funnel.conversion.deal} dari ${funnel.conversion.lead} lead Deal`} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Laporan follow-up */}
      <FollowupReport data={fuReport} loading={loading} rangeLabel={rangeLabel} />

      {/* Charts */}
      <div className="an-charts">
        <div className="an-chart-box">
          <SectionHead icon={Activity} title="Aktivitas Pesan" right={rangeLabel} />
          {loading ? <div className="an-skel" /> : chartData.every(d => d.Masuk === 0 && d.Keluar === 0 && d['Lead Baru'] === 0) ? (
            <div className="an-chart-empty">Belum ada data pesan</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)' }} />
                <Line type="monotone" dataKey="Masuk" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Keluar" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Lead Baru" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="an-chart-box">
          <SectionHead icon={BarChart2} title="Performa Agent" right="Total Lead · Prospek · Deal" />
          {loading ? <div className="an-skel" /> : agents.length === 0 ? (
            <div className="an-chart-empty">Belum ada percakapan yang di-assign</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)' }} />
                <Bar dataKey="Total Lead" fill="#2563eb" radius={[4,4,0,0]} />
                <Bar dataKey="Prospek" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="Deal" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Template Terpopuler */}
      {!loading && topTemplates.length > 0 && (
        <div className="an-table-box">
          <SectionHead icon={Zap} title="Template Terpopuler" right="sepanjang waktu" />
          <div className="an-tpl-list">
            {topTemplates.map((t, i) => (
              <div key={t.id} className="an-tpl-item">
                <span className="an-tpl-rank">#{i + 1}</span>
                <div className="an-tpl-body">
                  <div className="an-tpl-title">{t.title}</div>
                  <div className="an-tpl-preview">{t.body}</div>
                </div>
                <span className="an-tpl-count">{t.usage_count || 0}x dipakai</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .an-page { padding: 24px 24px 40px; width: 100%; color: var(--text); }

        /* Header */
        .an-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
        .an-header h1 { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; color: var(--text); }
        .an-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .an-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 10px; background: var(--surface); color: var(--text2); border: 1px solid var(--border); font-size: 13px; font-weight: 600; white-space: nowrap; transition: background 0.15s, border-color 0.15s; }
        .an-btn:hover:not(:disabled) { background: var(--surface2); border-color: var(--border2); }
        .an-btn:disabled { opacity: 0.6; }
        .an-btn.icon { width: 38px; padding: 0; }
        .an-dd { position: relative; }
        .an-menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 200px; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 32px var(--shadow); z-index: 50; }
        .an-menu button { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px; font-size: 13px; color: var(--text); text-align: left; }
        .an-menu button svg { color: var(--muted); }
        .an-menu button:hover { background: var(--surface3); }

        /* Filter */
        .an-filter { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 1px 3px var(--shadow); }
        .an-filter-group { display: flex; align-items: center; gap: 8px; }
        .an-filter-icon { color: var(--muted); flex-shrink: 0; }
        .an-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .an-seg button { height: 30px; padding: 0 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
        .an-seg button:hover:not(.active) { background: var(--surface3); }
        .an-seg button.active { background: var(--primary); color: var(--on-primary); box-shadow: 0 1px 3px var(--shadow); }
        .an-seg button.barat.active { background: #2563eb; }
        .an-seg button.timur.active { background: #d97706; }
        .an-seg button:disabled { cursor: progress; }
        .an-date-range { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .an-date-range span { font-size: 12px; color: var(--muted); }
        .an-date-range input[type="date"] { height: 36px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); padding: 0 10px; font-size: 13px; outline: none; cursor: pointer; font-family: inherit; }
        .an-date-range input[type="date"]:focus { border-color: var(--primary); }
        .an-apply { height: 36px; padding: 0 14px; border-radius: 9px; background: var(--primary); color: var(--on-primary); font-size: 13px; font-weight: 600; transition: background 0.15s; }
        .an-apply:hover:not(:disabled) { background: var(--primary-hover); }
        .an-apply:disabled { opacity: 0.5; }
        .an-range-note { margin: 10px 2px 16px; font-size: 12.5px; color: var(--muted); }
        .an-range-note b { color: var(--text2); font-weight: 600; }

        .an-error { background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.35); border-radius: 10px; padding: 12px 16px; color: var(--danger); font-size: 13px; margin-bottom: 16px; }

        /* Judul bagian */
        .an-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .an-sec-head h3 { display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; color: var(--text); }
        .an-sec-head h3 svg { color: var(--primary); }
        .an-sec-right { font-size: 12px; color: var(--muted); }

        .an-tpl-list { display: flex; flex-direction: column; gap: 8px; }
        .an-tpl-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .an-tpl-rank { font-size: 13px; font-weight: 700; color: var(--primary); width: 24px; flex-shrink: 0; }
        .an-tpl-body { flex: 1; min-width: 0; }
        .an-tpl-title { font-size: 13px; font-weight: 600; color: var(--text); }
        .an-tpl-preview { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-tpl-count { font-size: 12px; font-weight: 700; color: var(--success); white-space: nowrap; flex-shrink: 0; }

        /* Kartu statistik */
        .an-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .an-stat { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; min-width: 0; box-shadow: 0 1px 3px var(--shadow); }
        .an-stat-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .an-stat-icon { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .an-stat-val { font-size: 26px; font-weight: 800; line-height: 1.1; color: var(--text); letter-spacing: -0.3px; }
        .an-stat-skel { height: 28px; width: 60%; border-radius: 8px; background: var(--skeleton); animation: pulse 1.4s ease infinite; }
        .an-stat-lbl { font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-stat-sub { font-size: 11.5px; color: var(--muted); }

        /* Charts */
        .an-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
        .an-chart-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; min-width: 0; box-shadow: 0 1px 3px var(--shadow); }
        .an-chart-sub { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
        .an-skel { height: 220px; background: var(--skeleton); border-radius: 8px; animation: pulse 1.4s ease infinite; }
        .an-chart-empty { height: 220px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
        .an-tip { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 12px; box-shadow: 0 4px 16px var(--shadow); }
        .an-tip-lbl { font-weight: 600; margin-bottom: 6px; color: var(--text); }

        /* KPI & Funnel */
        .an-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
        .an-kpi-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; min-width: 0; box-shadow: 0 1px 3px var(--shadow); }
        .an-kpi-big { font-size: 44px; font-weight: 800; line-height: 1; }
        .an-kpi-sub { font-size: 12px; color: var(--text2); margin-top: 6px; margin-bottom: 12px; }
        .an-kpi-agents { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 12px; }
        .an-kpi-agent-row { display: flex; align-items: center; gap: 10px; }
        .an-kpi-agent-name { font-size: 12px; color: var(--text2); width: 120px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-kpi-bar { flex: 1; height: 8px; background: var(--surface3); border-radius: 999px; overflow: hidden; }
        .an-kpi-bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
        .an-kpi-agent-pct { font-size: 11px; font-weight: 600; color: var(--text); width: 92px; text-align: right; flex-shrink: 0; }
        .an-funnel { display: flex; flex-direction: column; gap: 10px; }
        .an-funnel-row { display: flex; align-items: center; gap: 10px; }
        .an-funnel-lbl { font-size: 12px; color: var(--text2); width: 120px; flex-shrink: 0; }
        .an-funnel-bar-wrap { flex: 1; background: var(--surface3); border-radius: 6px; overflow: hidden; }
        .an-funnel-bar { height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding: 0 8px; min-width: 24px; transition: width 0.3s; }
        .an-funnel-count { font-size: 12px; font-weight: 700; color: var(--on-primary); }
        .an-funnel-pct { font-size: 12px; font-weight: 600; color: var(--text2); width: 42px; text-align: right; flex-shrink: 0; }

        /* Table */
        .an-table-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px var(--shadow); }
        .an-table-wrap { overflow-x: auto; }
        .an-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 760px; }
        .an-agent-table { min-width: 880px; }
        .an-agent-table th.num, .an-agent-table td.num { padding-left: 6px; padding-right: 6px; }
        .an-agent-table th { letter-spacing: 0.2px; }
        .an-table-note { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--muted); line-height: 1.45; }
        .an-table-note > span { display: flex; align-items: flex-start; gap: 6px; }
        .an-table-note svg { flex-shrink: 0; margin-top: 2px; }
        .an-note-warn { color: #d97706; font-weight: 600; }
        .an-conv { display: flex; flex-direction: column; gap: 5px; }
        .an-conv-step { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .an-conv-lbl { width: 92px; flex-shrink: 0; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
        .an-conv-pct { min-width: 34px; text-align: right; font-size: 12px; font-weight: 700; color: var(--text2); font-variant-numeric: tabular-nums; }
        .an-rate-bar { flex: 1; height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
        .an-rate-fill { height: 100%; background: var(--primary); border-radius: 3px; }
        .an-rate-fill.deal { background: #10b981; }
        .an-total { font-size: 13.5px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
        .an-funnel-fail { font-size: 12px; color: var(--danger); margin-top: 2px; }
        .an-conv-total { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--border); }
        .an-conv-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); }
        .an-conv-total .an-conv-lbl { width: 120px; font-size: 12.5px; color: var(--text2); }
        .an-kpi-wait { color: #d97706; font-weight: 600; }
        .an-table th { text-align: left; padding: 9px 12px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; line-height: 1.3; border-bottom: 1px solid var(--border); vertical-align: bottom; }
        .an-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text); overflow: hidden; }
        .an-table th.num, .an-table td.num { text-align: center; }
        .an-table tr:last-child td { border-bottom: none; }
        .an-table tr:hover td { background: var(--surface2); }
        .an-agent-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .an-agent-id { min-width: 0; }
        .an-agent-name, .an-agent-email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-light); color: var(--primary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .an-agent-name { font-size: 13px; font-weight: 500; color: var(--text); }
        .an-agent-email { font-size: 11px; color: var(--muted); }
        .an-badge { display: inline-block; min-width: 28px; text-align: center; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        /* Warna transparan agar nyaman di mode gelap & terang */
        .an-badge.old { background: rgba(100,116,139,0.16); color: var(--text2); }
        .an-badge.active { background: rgba(14,165,233,0.14); color: #0ea5e9; }
        .an-badge.open { background: rgba(37,99,235,0.14); color: #3b82f6; }
        .an-badge.progress { background: rgba(217,119,6,0.14); color: #d97706; }
        .an-badge.resolved { background: rgba(16,185,129,0.14); color: #10b981; }
        .an-badge.lead { background: rgba(37,99,235,0.14); color: #3b82f6; }
        .an-badge.prospek { background: rgba(99,102,241,0.15); color: #6366f1; }
        .an-badge.deal { background: rgba(16,185,129,0.14); color: #10b981; }
        @media (prefers-color-scheme: dark) { .an-badge.prospek { color: #a5b4fc; } .an-badge.lead, .an-badge.open { color: #7aa7ff; } }
        .an-resp { display: inline-block; min-width: 44px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--success); background: rgba(16,185,129,0.12); font-variant-numeric: tabular-nums; }
        .an-resp.slow { color: #d97706; background: rgba(217,119,6,0.13); }
        .an-resp.none { color: var(--muted); background: none; }

        @media (max-width: 1100px) { .an-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) {
          .an-page { padding: 16px 14px 32px; }
          .an-filter { flex-direction: column; align-items: stretch; gap: 10px; }
          .an-filter-group .an-seg { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
          .an-seg button { padding: 0 6px; }
          .an-date-range { margin-left: 0; display: grid; grid-template-columns: 1fr auto 1fr; }
          .an-date-range input[type="date"] { min-width: 0; width: 100%; }
          .an-apply { grid-column: 1 / -1; }
          .an-cards { gap: 10px; }
          .an-stat { padding: 12px 14px; }
          .an-stat-val { font-size: 22px; }
          .an-charts, .an-kpi-row { grid-template-columns: 1fr; }
          .an-table-box, .an-chart-box, .an-kpi-box { padding: 14px; }
          .an-sec-right { width: 100%; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

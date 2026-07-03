import { useState, useEffect, useCallback } from 'react'
import { getDailyStats, getAgentStats, getContactStats, getContacts, getConversations, getTopTemplates, getResponseKpi, getFunnel } from '../hooks/useApi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { RefreshCw, TrendingUp, Users, MessageSquare, UserCheck, Clock, UserPlus, Calendar, Download, Zap } from 'lucide-react'

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

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

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="an-stat">
      <div className="an-stat-icon" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div className="an-stat-body">
        <div className="an-stat-val">{value ?? '—'}</div>
        <div className="an-stat-lbl">{label}</div>
        {sub != null && <div className="an-stat-sub">{sub}</div>}
      </div>
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
  const defaultFrom = fmtDate(new Date(Date.now() - 13 * 86400000))

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [daily, setDaily] = useState([])
  const [agents, setAgents] = useState([])
  const [contacts, setContacts] = useState(null)
  const [topTemplates, setTopTemplates] = useState([])
  const [kpi, setKpi] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  const load = useCallback(async (f, t) => {
    setLoading(true)
    setError('')
    try {
      const [d, a, c, tpl, k, fn] = await Promise.all([
        getDailyStats(f, t), getAgentStats(), getContactStats(),
        getTopTemplates(5).catch(() => []),
        getResponseKpi(f, t).catch(() => null),
        getFunnel(f, t).catch(() => null),
      ])
      setDaily(Array.isArray(d) ? d : [])
      setAgents(Array.isArray(a) ? a : [])
      setContacts(c || null)
      setTopTemplates(Array.isArray(tpl) ? tpl : [])
      setKpi(k || null)
      setFunnel(fn || null)
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

  const handleApply = () => { if (from && to) load(from, to) }
  const handlePreset = (days) => {
    const t = fmtDate(new Date())
    const f = fmtDate(new Date(Date.now() - (days - 1) * 86400000))
    setFrom(f); setTo(t)
    load(f, t)
  }

  const totalMessages = daily.reduce((s, d) => s + (d.messages || 0), 0)
  const totalIncoming = daily.reduce((s, d) => s + (d.incoming || 0), 0)
  const totalOutgoing = daily.reduce((s, d) => s + (d.outgoing || 0), 0)
  const totalResolved = agents.reduce((s, a) => s + (a.resolved || 0), 0)
  const totalHandled = agents.reduce((s, a) => s + (a.total || 0), 0)
  // Chat aktif yang sedang dihandle = open + in_progress (belum resolved)
  const totalActive = agents.reduce((s, a) => s + (a.open || 0) + (a.in_progress || 0), 0)
  const totalOpen = agents.reduce((s, a) => s + (a.open || 0), 0)

  const responseTimes = agents.filter(a => a.avgResponse != null).map(a => a.avgResponse)
  const globalAvgResponse = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
    : null

  const chartData = daily.map(d => ({
    date: new Date(d.date).toLocaleDateString('id', { day: 'numeric', month: 'short' }),
    Masuk: d.incoming || 0,
    Keluar: d.outgoing || 0,
    'Kontak Baru': d.new_contacts || 0,
  }))

  const agentChart = agents.map(a => ({
    name: a.name || 'Agent',
    Lead: a.lead != null ? a.lead : (a.total || 0),
    Penawaran: a.penawaran || 0,
    Survey: a.survey || 0,
    Deal: a.deal || 0,
  }))

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <div>
          <h1>Analytics</h1>
          <p>Statistik pesan dan performa agent</p>
        </div>
        <div className="an-header-actions">
          <button className="an-refresh" onClick={handleExportContacts} disabled={!!exporting}>
            <Download size={15} />
            {exporting === 'contacts' ? 'Mengekspor...' : 'Export Kontak'}
          </button>
          <button className="an-refresh" onClick={handleExportConversations} disabled={!!exporting}>
            <Download size={15} />
            {exporting === 'conversations' ? 'Mengekspor...' : 'Export Percakapan'}
          </button>
          <button className="an-refresh" onClick={() => load(from, to)} disabled={loading}>
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="an-filter">
        <Calendar size={15} className="an-filter-icon" />
        <div className="an-presets">
          <button onClick={() => handlePreset(7)}>7 Hari</button>
          <button onClick={() => handlePreset(14)}>14 Hari</button>
          <button onClick={() => handlePreset(30)}>30 Hari</button>
        </div>
        <div className="an-date-range">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} />
          <span>s/d</span>
          <input type="date" value={to} min={from} max={fmtDate(new Date())} onChange={e => setTo(e.target.value)} />
          <button className="an-apply" onClick={handleApply} disabled={loading || !from || !to}>
            Terapkan
          </button>
        </div>
      </div>

      {error && <div className="an-error">{error}</div>}

      {/* Summary cards */}
      <div className="an-cards">
        <StatCard icon={MessageSquare} label="Total Pesan" value={totalMessages} color="#2563eb" />
        <StatCard icon={TrendingUp} label="Pesan Masuk" value={totalIncoming} color="#2563eb" />
        <StatCard icon={TrendingUp} label="Pesan Keluar" value={totalOutgoing} color="#f59e0b" />
        <StatCard
          icon={UserPlus}
          label="Total Kontak"
          value={contacts?.total ?? '—'}
          sub={contacts?.newToday != null ? `+${contacts.newToday} hari ini` : null}
          color="#2563eb"
        />
        <StatCard
          icon={MessageSquare}
          label="Sedang Dihandle"
          value={totalActive}
          sub={`${totalOpen} open`}
          color="#0ea5e9"
        />
        <StatCard icon={UserCheck} label="Resolved" value={totalResolved} color="#10b981" />
        <StatCard icon={Users} label="Di-assign" value={totalHandled} color="#6366f1" />
        <StatCard
          icon={Clock}
          label="Avg Respons"
          value={globalAvgResponse != null ? `${globalAvgResponse} mnt` : '—'}
          color="#f59e0b"
        />
      </div>

      {/* KPI Response Time & Funnel */}
      <div className="an-kpi-row">
        <div className="an-kpi-box">
          <h3><Clock size={14} style={{ verticalAlign: -2, marginRight: 4 }} />KPI Response &lt;{kpi?.kpiMinutes ?? 5} menit</h3>
          {loading ? <div className="an-skel" style={{ height: 120 }} /> : !kpi || kpi.total === 0 ? (
            <div className="an-chart-empty">Belum ada data balasan pada rentang ini</div>
          ) : (
            <>
              <div className="an-kpi-big" style={{ color: kpi.percent >= 80 ? '#10b981' : kpi.percent >= 50 ? '#f59e0b' : '#ef4444' }}>
                {kpi.percent}%
              </div>
              <div className="an-kpi-sub">{kpi.met} dari {kpi.total} percakapan dibalas ≤{kpi.kpiMinutes} menit</div>
              {kpi.agents?.length > 0 && (
                <div className="an-kpi-agents">
                  {kpi.agents.map(a => (
                    <div key={a.agent_id || 'unassigned'} className="an-kpi-agent-row">
                      <span className="an-kpi-agent-name">{a.name}</span>
                      <div className="an-kpi-bar"><div className="an-kpi-bar-fill" style={{ width: `${a.percent}%`, background: a.percent >= 80 ? '#10b981' : a.percent >= 50 ? '#f59e0b' : '#ef4444' }} /></div>
                      <span className="an-kpi-agent-pct">{a.percent}% <span style={{color:'var(--muted)'}}>({a.met}/{a.total})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="an-kpi-box">
          <h3><TrendingUp size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Funnel Konversi</h3>
          {loading ? <div className="an-skel" style={{ height: 120 }} /> : !funnel || !funnel.stages?.length ? (
            <div className="an-chart-empty">Belum ada data funnel</div>
          ) : (
            <div className="an-funnel">
              {funnel.stages.map((s, i) => {
                const base = funnel.stages[0]?.count || 1
                const pct = Math.round((s.count / base) * 100)
                const colors = ['#2563eb', '#6366f1', '#f59e0b', '#10b981', '#0ea5e9']
                return (
                  <div key={s.stage} className="an-funnel-row">
                    <span className="an-funnel-lbl">{s.stage}</span>
                    <div className="an-funnel-bar-wrap">
                      <div className="an-funnel-bar" style={{ width: `${Math.max(pct, 3)}%`, background: colors[i % colors.length] }}>
                        <span className="an-funnel-count">{s.count}</span>
                      </div>
                    </div>
                    <span className="an-funnel-pct">{pct}%</span>
                  </div>
                )
              })}
              {funnel.fail > 0 && (
                <div className="an-funnel-fail">Gagal/Batal (Fail): <strong>{funnel.fail}</strong></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="an-charts">
        <div className="an-chart-box">
          <h3>Aktivitas Pesan</h3>
          <p className="an-chart-sub">{from} – {to}</p>
          {loading ? <div className="an-skel" /> : chartData.every(d => d.Masuk === 0 && d.Keluar === 0) ? (
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
                <Line type="monotone" dataKey="Kontak Baru" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="an-chart-box">
          <h3>Performa Agent</h3>
          <p className="an-chart-sub">Funnel per agent (Lead → Penawaran → Survey → Deal)</p>
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
                <Bar dataKey="Lead" fill="#2563eb" radius={[4,4,0,0]} />
                <Bar dataKey="Penawaran" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="Survey" fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Deal" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Template Terpopuler */}
      {!loading && topTemplates.length > 0 && (
        <div className="an-table-box">
          <h3><Zap size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Template Terpopuler</h3>
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

      {/* Agent table */}
      {!loading && agents.length > 0 && (
        <div className="an-table-box">
          <h3>Detail per Agent</h3>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Aktif</th><th>Open</th><th>Resolved</th>
                  <th>Lead</th><th>Penawaran</th><th>Survey</th><th>Deal</th>
                  <th>Avg Respons</th><th>Deal Rate</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => {
                  const lead = a.lead != null ? a.lead : (a.total || 0)
                  const rate = lead > 0 ? Math.round(((a.deal || 0) / lead) * 100) : 0
                  const active = (a.open || 0) + (a.in_progress || 0)
                  return (
                    <tr key={i}>
                      <td>
                        <div className="an-agent-cell">
                          <div className="an-avatar">{(a.name || 'A')[0].toUpperCase()}</div>
                          <div>
                            <div className="an-agent-name">{a.name}</div>
                            <div className="an-agent-email">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="an-badge active" title={`${a.open||0} open + ${a.in_progress||0} in progress`}>{active}</span></td>
                      <td><span className="an-badge open">{a.open || 0}</span></td>
                      <td><span className="an-badge resolved">{a.resolved || 0}</span></td>
                      <td><span className="an-badge lead">{lead}</span></td>
                      <td><span className="an-badge penawaran">{a.penawaran || 0}</span></td>
                      <td><span className="an-badge survey">{a.survey || 0}</span></td>
                      <td><span className="an-badge deal">{a.deal || 0}</span></td>
                      <td><span className="an-resp">{a.avgResponse != null ? `${a.avgResponse} mnt` : '—'}</span></td>
                      <td>
                        <div className="an-rate">
                          <div className="an-rate-bar"><div className="an-rate-fill" style={{ width: `${rate}%` }} /></div>
                          <span>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .an-page { padding: 24px 24px 40px; width: 100%; color: var(--text); }

        /* Header */
        .an-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; margin-bottom: 16px;
        }
        .an-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 3px; color: var(--text); }
        .an-header p { font-size: 13px; color: var(--text2); }
        .an-refresh {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px;
          background: var(--surface); color: var(--text2);
          border: 1px solid var(--border);
          font-size: 13px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
          box-shadow: 0 1px 2px var(--shadow);
        }
        .an-refresh:hover { background: var(--surface2); border-color: var(--muted); }
        .an-refresh:disabled { opacity: 0.6; }
        .an-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }

        .an-tpl-list { display: flex; flex-direction: column; gap: 8px; }
        .an-tpl-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); }
        .an-tpl-rank { font-size: 13px; font-weight: 700; color: var(--primary); width: 24px; flex-shrink: 0; }
        .an-tpl-body { flex: 1; min-width: 0; }
        .an-tpl-title { font-size: 13px; font-weight: 600; color: var(--text); }
        .an-tpl-preview { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-tpl-count { font-size: 12px; font-weight: 600; color: var(--success); white-space: nowrap; flex-shrink: 0; }

        /* Date filter */
        .an-filter {
          display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
          padding: 12px 16px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 10px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px var(--shadow);
        }
        .an-filter-icon { color: var(--muted); flex-shrink: 0; }
        .an-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .an-presets button {
          padding: 4px 12px; border-radius: 16px;
          background: var(--surface3); color: var(--text2);
          font-size: 12px; font-weight: 500;
          border: 1px solid var(--border); transition: all 0.15s;
        }
        .an-presets button:hover { background: var(--surface3); color: var(--primary); border-color: var(--primary); }
        .an-date-range {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto;
        }
        .an-date-range span { font-size: 12px; color: var(--muted); }
        .an-date-range input[type="date"] {
          background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
          color: var(--text); padding: 5px 10px; font-size: 13px;
          outline: none; cursor: pointer;
        }
        .an-date-range input[type="date"]:focus { border-color: var(--primary); }
        .an-apply {
          padding: 6px 14px; border-radius: 6px;
          background: var(--primary); color: var(--on-primary);
          font-size: 13px; font-weight: 600; transition: opacity 0.15s;
        }
        .an-apply:hover { background: var(--primary-hover); }
        .an-apply:disabled { opacity: 0.5; }

        .an-error {
          background: var(--primary-light); border: 1px solid var(--danger);
          border-radius: 8px; padding: 12px 16px;
          color: var(--danger); font-size: 13px; margin-bottom: 20px;
        }

        /* Stat cards */
        .an-cards {
          display: grid;
          gap: 10px; margin-bottom: 20px;
        }
        @media (min-width: 1200px) { .an-cards { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 1199px) and (min-width: 800px) { .an-cards { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 799px) { .an-cards { grid-template-columns: repeat(2, 1fr); } }

        .an-stat {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 12px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 10px;
          min-width: 0;
          box-shadow: 0 1px 3px var(--shadow);
        }
        .an-stat-icon {
          width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .an-stat-body { min-width: 0; }
        .an-stat-val { font-size: 18px; font-weight: 700; line-height: 1; color: var(--text); }
        .an-stat-lbl { font-size: 11px; color: var(--text2); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-stat-sub { font-size: 11px; color: var(--success); margin-top: 2px; }

        /* Charts */
        .an-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px; margin-bottom: 20px;
        }
        .an-chart-box {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 18px; min-width: 0;
          box-shadow: 0 1px 3px var(--shadow);
        }
        .an-chart-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 3px; color: var(--text); }
        .an-chart-sub { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
        .an-skel { height: 220px; background: var(--skeleton); border-radius: 8px; animation: pulse 1.4s ease infinite; }
        .an-chart-empty { height: 220px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }
        .an-tip { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 12px; box-shadow: 0 4px 16px var(--shadow); }
        .an-tip-lbl { font-weight: 600; margin-bottom: 6px; color: var(--text); }

        /* KPI & Funnel */
        .an-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-bottom: 20px; }
        .an-kpi-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; min-width: 0; box-shadow: 0 1px 3px var(--shadow); }
        .an-kpi-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text); }
        .an-kpi-big { font-size: 44px; font-weight: 800; line-height: 1; }
        .an-kpi-sub { font-size: 12px; color: var(--text2); margin-top: 6px; margin-bottom: 12px; }
        .an-kpi-agents { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 12px; }
        .an-kpi-agent-row { display: flex; align-items: center; gap: 10px; }
        .an-kpi-agent-name { font-size: 12px; color: var(--text2); width: 110px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-kpi-bar { flex: 1; height: 8px; background: var(--surface3); border-radius: 999px; overflow: hidden; }
        .an-kpi-bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
        .an-kpi-agent-pct { font-size: 11px; font-weight: 600; color: var(--text); width: 92px; text-align: right; flex-shrink: 0; }
        .an-funnel { display: flex; flex-direction: column; gap: 10px; }
        .an-funnel-row { display: flex; align-items: center; gap: 10px; }
        .an-funnel-lbl { font-size: 12px; color: var(--text2); width: 80px; flex-shrink: 0; }
        .an-funnel-bar-wrap { flex: 1; background: var(--surface3); border-radius: 6px; overflow: hidden; }
        .an-funnel-bar { height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding: 0 8px; min-width: 24px; transition: width 0.3s; }
        .an-funnel-count { font-size: 12px; font-weight: 700; color: var(--on-primary); }
        .an-funnel-pct { font-size: 12px; font-weight: 600; color: var(--text2); width: 42px; text-align: right; flex-shrink: 0; }
        .an-funnel-fail { font-size: 12px; color: var(--danger); margin-top: 6px; padding-top: 10px; border-top: 1px solid var(--border); }

        /* Table */
        .an-table-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 28px; box-shadow: 0 1px 3px var(--shadow); }
        .an-table-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: var(--text); }
        .an-table-wrap { overflow-x: auto; }
        .an-table { width: 100%; border-collapse: collapse; }
        .an-table th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
        .an-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text); }
        .an-table tr:last-child td { border-bottom: none; }
        .an-table tr:hover td { background: var(--surface2); }
        .an-agent-cell { display: flex; align-items: center; gap: 8px; }
        .an-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#7c3aed); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--on-primary); }
        .an-agent-name { font-size: 13px; font-weight: 500; color: var(--text); }
        .an-agent-email { font-size: 11px; color: var(--muted); }
        .an-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .an-badge.active { background: #e0f2fe; color: #0284c7; }
        .an-badge.open { background: #eff6ff; color: #2563eb; }
        .an-badge.progress { background: #fffbeb; color: #d97706; }
        .an-badge.resolved { background: #f0fdf4; color: #10b981; }
        .an-badge.lead { background: #eff6ff; color: #2563eb; }
        .an-badge.penawaran { background: var(--surface3); color: #6366f1; }
        .an-badge.survey { background: #fffbeb; color: #d97706; }
        .an-badge.deal { background: #f0fdf4; color: #10b981; }
        .an-resp { font-size: 13px; color: var(--warning); font-weight: 500; }
        .an-rate { display: flex; align-items: center; gap: 6px; }
        .an-rate-bar { width: 60px; height: 5px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
        .an-rate-fill { height: 100%; background: var(--primary); border-radius: 3px; }
        .an-rate span { font-size: 12px; color: var(--text2); min-width: 28px; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

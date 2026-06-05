import { useState, useEffect, useCallback } from 'react'
import { getDailyStats, getAgentStats, getContactStats } from '../hooks/useApi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { RefreshCw, TrendingUp, Users, MessageSquare, UserCheck, Clock, UserPlus, Calendar } from 'lucide-react'

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="an-stat">
      <div className="an-stat-icon" style={{ background: `${color}22`, color }}>
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
  // Default date range: last 14 days
  const defaultTo = fmtDate(new Date())
  const defaultFrom = fmtDate(new Date(Date.now() - 13 * 86400000))

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [daily, setDaily] = useState([])
  const [agents, setAgents] = useState([])
  const [contacts, setContacts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (f, t) => {
    setLoading(true)
    setError('')
    try {
      const [d, a, c] = await Promise.all([getDailyStats(f, t), getAgentStats(), getContactStats()])
      setDaily(Array.isArray(d) ? d : [])
      setAgents(Array.isArray(a) ? a : [])
      setContacts(c || null)
    } catch {
      setError('Gagal memuat analytics. Cek koneksi backend.')
    } finally {
      setLoading(false)
    }
  }, [])

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
    Ditangani: a.total || 0,
    Resolved: a.resolved || 0,
  }))

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <div>
          <h1>Analytics</h1>
          <p>Statistik pesan dan performa agent</p>
        </div>
        <button className="an-refresh" onClick={() => load(from, to)} disabled={loading}>
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
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
        <StatCard icon={MessageSquare} label="Total Pesan" value={totalMessages} color="#53bdeb" />
        <StatCard icon={TrendingUp} label="Pesan Masuk" value={totalIncoming} color="#00a884" />
        <StatCard icon={TrendingUp} label="Pesan Keluar" value={totalOutgoing} color="#ffa929" />
        <StatCard
          icon={UserPlus}
          label="Total Kontak"
          value={contacts?.total ?? '—'}
          sub={contacts?.newToday != null ? `+${contacts.newToday} hari ini` : null}
          color="#53bdeb"
        />
        <StatCard icon={UserCheck} label="Resolved" value={totalResolved} color="#00a884" />
        <StatCard icon={Users} label="Di-assign" value={totalHandled} color="#8696a0" />
        <StatCard
          icon={Clock}
          label="Avg Respons"
          value={globalAvgResponse != null ? `${globalAvgResponse} mnt` : '—'}
          color="#ffa929"
        />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#222d34" />
                <XAxis dataKey="date" tick={{ fill: '#8696a0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8696a0', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8696a0' }} />
                <Line type="monotone" dataKey="Masuk" stroke="#00a884" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Keluar" stroke="#ffa929" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Kontak Baru" stroke="#53bdeb" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="an-chart-box">
          <h3>Performa Agent</h3>
          <p className="an-chart-sub">Percakapan ditangani per agent</p>
          {loading ? <div className="an-skel" /> : agents.length === 0 ? (
            <div className="an-chart-empty">Belum ada percakapan yang di-assign</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222d34" />
                <XAxis dataKey="name" tick={{ fill: '#8696a0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8696a0', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8696a0' }} />
                <Bar dataKey="Ditangani" fill="#53bdeb" radius={[4,4,0,0]} />
                <Bar dataKey="Resolved" fill="#00a884" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Agent table */}
      {!loading && agents.length > 0 && (
        <div className="an-table-box">
          <h3>Detail per Agent</h3>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Agent</th><th>Total</th><th>Open</th>
                  <th>In Progress</th><th>Resolved</th>
                  <th>Avg Respons</th><th>Resolution Rate</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => {
                  const rate = a.total > 0 ? Math.round(((a.resolved || 0) / a.total) * 100) : 0
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
                      <td>{a.total || 0}</td>
                      <td><span className="an-badge open">{a.open || 0}</span></td>
                      <td><span className="an-badge progress">{a.in_progress || 0}</span></td>
                      <td><span className="an-badge resolved">{a.resolved || 0}</span></td>
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
        .an-page { padding: 24px 24px 40px; width: 100%; color: #e9edef; }

        /* Header */
        .an-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; margin-bottom: 16px;
        }
        .an-header h1 { font-size: 20px; font-weight: 600; margin-bottom: 3px; }
        .an-header p { font-size: 13px; color: #8696a0; }
        .an-refresh {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px;
          background: #2a3942; color: #e9edef;
          font-size: 13px; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
        }
        .an-refresh:hover { background: #374a52; }
        .an-refresh:disabled { opacity: 0.6; }

        /* Date filter */
        .an-filter {
          display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
          padding: 12px 16px; background: #202c33;
          border: 1px solid #222d34; border-radius: 10px;
          margin-bottom: 20px;
        }
        .an-filter-icon { color: #8696a0; flex-shrink: 0; }
        .an-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .an-presets button {
          padding: 4px 12px; border-radius: 16px;
          background: #2a3942; color: #8696a0;
          font-size: 12px; font-weight: 500; transition: all 0.15s;
        }
        .an-presets button:hover { background: #374a52; color: #e9edef; }
        .an-date-range {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto;
        }
        .an-date-range span { font-size: 12px; color: #8696a0; }
        .an-date-range input[type="date"] {
          background: #2a3942; border: 1px solid #374a52; border-radius: 6px;
          color: #e9edef; padding: 5px 10px; font-size: 13px;
          outline: none; cursor: pointer;
        }
        .an-date-range input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        .an-apply {
          padding: 6px 14px; border-radius: 6px;
          background: #00a884; color: white;
          font-size: 13px; font-weight: 600; transition: opacity 0.15s;
        }
        .an-apply:hover { opacity: 0.85; }
        .an-apply:disabled { opacity: 0.5; }

        .an-error {
          background: rgba(241,92,109,0.1); border: 1px solid rgba(241,92,109,0.2);
          border-radius: 8px; padding: 12px 16px;
          color: #f15c6d; font-size: 13px; margin-bottom: 20px;
        }

        /* Stat cards — full width grid */
        .an-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(0, 1fr));
          gap: 10px; margin-bottom: 20px;
        }
        @media (min-width: 1200px) { .an-cards { grid-template-columns: repeat(7, 1fr); } }
        @media (max-width: 1199px) and (min-width: 800px) { .an-cards { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 799px) { .an-cards { grid-template-columns: repeat(2, 1fr); } }

        .an-stat {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 12px; background: #202c33;
          border: 1px solid #222d34; border-radius: 10px;
          min-width: 0;
        }
        .an-stat-icon {
          width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .an-stat-body { min-width: 0; }
        .an-stat-val { font-size: 18px; font-weight: 700; line-height: 1; }
        .an-stat-lbl { font-size: 11px; color: #8696a0; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-stat-sub { font-size: 11px; color: #00a884; margin-top: 2px; }

        /* Charts */
        .an-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px; margin-bottom: 20px;
        }
        .an-chart-box {
          background: #202c33; border: 1px solid #222d34;
          border-radius: 10px; padding: 18px; min-width: 0;
        }
        .an-chart-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
        .an-chart-sub { font-size: 12px; color: #8696a0; margin-bottom: 14px; }
        .an-skel { height: 220px; background: #2a3942; border-radius: 8px; animation: pulse 1.4s ease infinite; }
        .an-chart-empty { height: 220px; display: flex; align-items: center; justify-content: center; color: #8696a0; font-size: 13px; }
        .an-tip { background: #1a2429; border: 1px solid #2a3942; border-radius: 8px; padding: 10px 14px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
        .an-tip-lbl { font-weight: 600; margin-bottom: 6px; color: #e9edef; }

        /* Table */
        .an-table-box { background: #202c33; border: 1px solid #222d34; border-radius: 10px; padding: 18px; margin-bottom: 28px; }
        .an-table-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 14px; }
        .an-table-wrap { overflow-x: auto; }
        .an-table { width: 100%; border-collapse: collapse; }
        .an-table th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; color: #8696a0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #222d34; }
        .an-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #1a2429; color: #e9edef; }
        .an-table tr:last-child td { border-bottom: none; }
        .an-table tr:hover td { background: #233138; }
        .an-agent-cell { display: flex; align-items: center; gap: 8px; }
        .an-avatar { width: 28px; height: 28px; border-radius: 50%; background: #005c4b; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; }
        .an-agent-name { font-size: 13px; font-weight: 500; }
        .an-agent-email { font-size: 11px; color: #8696a0; }
        .an-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .an-badge.open { background: rgba(83,189,235,0.15); color: #53bdeb; }
        .an-badge.progress { background: rgba(255,169,41,0.15); color: #ffa929; }
        .an-badge.resolved { background: rgba(0,168,132,0.15); color: #00a884; }
        .an-resp { font-size: 13px; color: #ffa929; font-weight: 500; }
        .an-rate { display: flex; align-items: center; gap: 6px; }
        .an-rate-bar { width: 60px; height: 5px; background: #2a3942; border-radius: 3px; overflow: hidden; }
        .an-rate-fill { height: 100%; background: #00a884; border-radius: 3px; }
        .an-rate span { font-size: 12px; color: #8696a0; min-width: 28px; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

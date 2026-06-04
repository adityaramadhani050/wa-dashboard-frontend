import { useState, useEffect } from 'react'
import { getDailyStats, getAgentStats } from '../hooks/useApi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { RefreshCw, TrendingUp, Users, MessageSquare, UserCheck } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color = 'var(--green)' }) {
  return (
    <div className="stat-card card">
      <div className="stat-icon" style={{ background: `${color}1a`, color }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [dailyStats, setDailyStats] = useState([])
  const [agentStats, setAgentStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [daily, agents] = await Promise.all([getDailyStats(), getAgentStats()])
      setDailyStats(Array.isArray(daily) ? daily : daily?.data || [])
      setAgentStats(Array.isArray(agents) ? agents : agents?.data || [])
      setError('')
    } catch {
      setError('Failed to load analytics data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const totalMessages = dailyStats.reduce((s, d) => s + (d.messages || d.messageCount || 0), 0)
  const totalContacts = dailyStats.reduce((s, d) => s + (d.newContacts || d.contacts || 0), 0)
  const totalResolved = agentStats.reduce((s, a) => s + (a.resolved || 0), 0)
  const avgResponseTime = agentStats.length
    ? Math.round(agentStats.reduce((s, a) => s + (a.avgResponseTime || 0), 0) / agentStats.length)
    : null

  const chartData = dailyStats.map(d => ({
    date: d.date ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : d.day || d.label,
    Messages: d.messages || d.messageCount || 0,
    Contacts: d.newContacts || d.contacts || 0,
  }))

  return (
    <div className="analytics-page fade-in">
      <div className="analytics-header">
        <div>
          <h1>Analytics</h1>
          <p>Performance overview and agent metrics</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStats} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stats-grid">
        <StatCard icon={MessageSquare} label="Total Messages" value={totalMessages} color="var(--blue)" />
        <StatCard icon={Users} label="New Contacts" value={totalContacts} color="var(--purple)" />
        <StatCard icon={UserCheck} label="Resolved" value={totalResolved} color="var(--green)" />
        <StatCard icon={TrendingUp} label="Avg Response (min)" value={avgResponseTime} color="var(--orange)" />
      </div>

      <div className="charts-grid">
        <div className="chart-card card">
          <h3>Daily Activity</h3>
          <p className="chart-subtitle">Messages and new contacts over time</p>
          {loading ? (
            <div className="chart-skeleton" />
          ) : chartData.length === 0 ? (
            <div className="chart-empty">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Messages" stroke="var(--blue)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Contacts" stroke="var(--purple)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {agentStats.length > 0 && (
          <div className="chart-card card">
            <h3>Agent Performance</h3>
            <p className="chart-subtitle">Conversations handled per agent</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={agentStats.map(a => ({
                  name: a.agentName || a.name || a.agent || 'Agent',
                  Handled: a.handled || a.conversations || 0,
                  Resolved: a.resolved || 0,
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Handled" fill="var(--blue)" radius={[4,4,0,0]} />
                <Bar dataKey="Resolved" fill="var(--green)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!loading && agentStats.length > 0 && (
        <div className="agent-table card">
          <h3>Agent Breakdown</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Handled</th>
                  <th>Resolved</th>
                  <th>Avg Response</th>
                  <th>Resolution Rate</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a, i) => {
                  const handled = a.handled || a.conversations || 0
                  const resolved = a.resolved || 0
                  const rate = handled > 0 ? Math.round((resolved / handled) * 100) : 0
                  return (
                    <tr key={i}>
                      <td>
                        <div className="agent-cell">
                          <div className="agent-av">{(a.agentName || a.name || 'A')[0].toUpperCase()}</div>
                          {a.agentName || a.name || 'Agent'}
                        </div>
                      </td>
                      <td>{handled}</td>
                      <td>{resolved}</td>
                      <td>{a.avgResponseTime ? `${a.avgResponseTime}m` : '—'}</td>
                      <td>
                        <div className="rate-bar">
                          <div className="rate-fill" style={{ width: `${rate}%` }} />
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
        .analytics-page { padding: 28px 24px; }
        .analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .analytics-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .analytics-header p { color: var(--text-muted); font-size: 13px; }
        .error-banner {
          background: rgba(255,71,87,0.1);
          border: 1px solid rgba(255,71,87,0.2);
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          color: var(--red);
          font-size: 13px;
          margin-bottom: 20px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-value { font-size: 24px; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .chart-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .chart-subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
        .chart-skeleton {
          height: 240px;
          background: var(--bg-hover);
          border-radius: var(--radius-sm);
          animation: pulse 1.4s ease infinite;
        }
        .chart-empty {
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .chart-tooltip {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 12px;
          box-shadow: var(--shadow);
        }
        .tooltip-label { font-weight: 600; margin-bottom: 6px; color: var(--text); }
        .agent-table h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th {
          text-align: left;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border);
        }
        td {
          padding: 12px 14px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--bg-hover); }
        .agent-cell { display: flex; align-items: center; gap: 10px; }
        .agent-av {
          width: 28px;
          height: 28px;
          background: var(--green-dark);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
        .rate-bar {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rate-fill {
          height: 6px;
          background: var(--green);
          border-radius: 3px;
          min-width: 4px;
          max-width: 80px;
          transition: width 0.4s ease;
        }
        .rate-bar span { font-size: 12px; color: var(--text-muted); min-width: 30px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          .analytics-page { padding: 16px; }
          .charts-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

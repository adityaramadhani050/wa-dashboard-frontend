import { useEffect, useState } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { getAiUsage, getOpenRouterStatus } from '../hooks/useApi'

// Pemakaian token AI per fitur (Manajemen Agent → AI Sales → Pemakaian).
const fmt = (n) => (n || 0).toLocaleString('id-ID')
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} jt` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace('.', ',')} rb` : fmt(n))
const usd = (n) => !n ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
const RANGES = [{ d: 1, label: 'Hari ini' }, { d: 7, label: '7 hari' }, { d: 30, label: '30 hari' }]

export default function AiUsagePanel() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => { getOpenRouterStatus().then(setStatus).catch(() => {}) }, [])

  useEffect(() => {
    setLoading(true)
    getAiUsage(days).then(d => { setData(d); setError('') })
      .catch(e => setError(e?.response?.data?.error || 'Gagal memuat pemakaian AI'))
      .finally(() => setLoading(false))
  }, [days])

  const t = days === 1 ? data?.today : data?.total
  const features = data?.features || []
  const daily = data?.daily || []
  const maxDay = Math.max(1, ...daily.map(d => d.input + d.output))
  const cachePct = t?.input ? Math.round((t.cached / t.input) * 100) : 0
  const freeLimit = status?.free_daily_limit
  const freeUsed = data?.free_today || 0
  const freePct = freeLimit ? Math.min(100, Math.round((freeUsed / freeLimit) * 100)) : 0

  return (
    <div className="ak-section">
      <div className="ak-head">
        <div>
          <div className="aa-title">Pemakaian Token AI</div>
          <div className="aa-desc">Jumlah token yang dipakai setiap fitur AI. Token input = konteks yang dibacakan ke AI (riwayat, skill, ingatan…), output = teks yang ditulis AI. Token "ter-cache" ditagih lebih murah. Biaya dari OpenRouter (model gratis = $0).</div>
        </div>
        <div className="au-seg">
          {RANGES.map(r => <button key={r.d} className={days === r.d ? 'active' : ''} onClick={() => setDays(r.d)}>{r.label}</button>)}
        </div>
      </div>

      {error ? <div className="rr-warn"><AlertTriangle size={14} /> {error}</div> : loading && !data ? <div className="ak-empty">Memuat…</div> : (
        <>
          <div className="au-cards">
            <div className="au-card"><span>Panggilan AI</span><b>{fmt(t?.calls)}</b></div>
            <div className="au-card"><span>Token input</span><b>{short(t?.input)}</b><small>{cachePct}% ter-cache</small></div>
            <div className="au-card"><span>Token output</span><b>{short(t?.output)}</b></div>
            <div className="au-card"><span>Biaya</span><b>{usd(t?.cost)}</b><small>{t?.calls ? `${short(Math.round((t.input + t.output) / t.calls))} token / panggilan` : 'USD'}</small></div>
          </div>

          {freeLimit && (
            <div className={`au-limit${freePct >= 80 ? ' warn' : ''}`}>
              <div className="au-limit-top">
                <span>Request model gratis hari ini</span>
                <b>{fmt(freeUsed)} / {fmt(freeLimit)}</b>
              </div>
              <div className="au-bar"><div style={{ width: `${Math.max(freeUsed ? 2 : 0, freePct)}%` }} /></div>
              {freePct >= 80 && <small><AlertTriangle size={12} /> Hampir mencapai batas harian; setelah itu model cadangan yang dipakai.{status?.free_tier ? ' Top-up $10 sekali di OpenRouter untuk menaikkan batas ke 1.000/hari.' : ''}</small>}
            </div>
          )}

          {features.length === 0 ? (
            <div className="ak-empty"><Activity size={28} strokeWidth={1.5} />Belum ada pemakaian AI pada periode ini.</div>
          ) : (
            <div className="au-table-wrap">
              <table className="au-table">
                <thead><tr><th>Fitur</th><th className="num">Panggilan</th><th className="num">Input</th><th className="num">Ter-cache</th><th className="num">Output</th><th className="num">Biaya</th><th>Model</th><th>Porsi</th></tr></thead>
                <tbody>
                  {features.map(f => {
                    const share = data.total.input + data.total.output ? Math.round(((f.input + f.output) / (data.total.input + data.total.output)) * 100) : 0
                    return (
                      <tr key={f.key}>
                        <td>{f.label}</td>
                        <td className="num">{fmt(f.calls)}</td>
                        <td className="num">{short(f.input)}</td>
                        <td className="num">{f.input ? `${Math.round((f.cached / f.input) * 100)}%` : '—'}</td>
                        <td className="num">{short(f.output)}</td>
                        <td className="num">{usd(f.cost)}</td>
                        <td className="au-models">{(f.models || []).slice(0, 2).map(m => <div key={m.model} title={`${fmt(m.calls)} panggilan`}>{m.model}{f.models.length > 1 && <span> · {fmt(m.calls)}×</span>}</div>)}</td>
                        <td><div className="au-share"><div className="au-bar"><div style={{ width: `${share}%` }} /></div><span>{share}%</span></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {days > 1 && daily.length > 1 && (
            <div className="au-daily">
              <div className="au-daily-title">Per hari</div>
              <div className="au-daily-bars">
                {daily.map(d => (
                  <div key={d.date} className="au-day" title={`${d.date}: ${fmt(d.input + d.output)} token, ${fmt(d.calls)} panggilan`}>
                    <div className="au-day-bar" style={{ height: `${Math.max(3, Math.round(((d.input + d.output) / maxDay) * 100))}%` }} />
                    <span>{new Date(`${d.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`
        .au-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); flex-shrink: 0; }
        .au-seg button { height: 30px; padding: 0 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; }
        .au-seg button.active { background: var(--primary); color: var(--on-primary); }
        .au-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .au-card { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .au-card span { font-size: 12px; color: var(--text2); font-weight: 600; }
        .au-card b { font-size: 22px; font-weight: 800; color: var(--text); }
        .au-card small { font-size: 11.5px; color: var(--muted); }
        .au-table-wrap { overflow-x: auto; }
        .au-table { width: 100%; border-collapse: collapse; min-width: 760px; }
        .au-models div { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: var(--text2); white-space: nowrap; max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
        .au-models span { color: var(--muted); }
        .au-limit { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
        .au-limit-top { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--text2); font-weight: 600; }
        .au-limit-top b { color: var(--text); font-variant-numeric: tabular-nums; }
        .au-limit .au-bar { flex: none; height: 8px; }
        .au-limit.warn .au-bar div { background: var(--warning, #d08b28); }
        .au-limit small { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--warning, #d08b28); }
        .au-table th { text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
        .au-table td { font-size: 13px; color: var(--text); padding: 9px 10px; border-bottom: 1px solid var(--border); }
        .au-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .au-share { display: flex; align-items: center; gap: 8px; }
        .au-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--surface3); overflow: hidden; min-width: 60px; }
        .au-bar div { height: 100%; background: #8b5cf6; border-radius: 3px; }
        .au-share span { font-size: 12px; color: var(--text2); min-width: 34px; text-align: right; }
        .au-daily-title { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
        .au-daily-bars { display: flex; align-items: flex-end; gap: 4px; height: 120px; overflow-x: auto; }
        .au-day { flex: 1; min-width: 26px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
        .au-day-bar { width: 70%; background: rgba(139,92,246,0.55); border-radius: 4px 4px 0 0; }
        .au-day span { font-size: 9.5px; color: var(--muted); white-space: nowrap; }
        @media (max-width: 768px) { .au-cards { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  )
}

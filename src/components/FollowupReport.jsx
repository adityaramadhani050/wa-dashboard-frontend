import { ListChecks, AlertTriangle, Trophy } from 'lucide-react'
import { STEP_INFO } from './followupUi'

const pct = (v) => (v == null ? '—' : `${v}%`)
const toneOf = (v) => (v == null ? 'var(--muted)' : v >= 80 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444')

function MiniStat({ label, value, sub, color }) {
  return (
    <div className="fr-stat">
      <span className="fr-stat-label">{label}</span>
      <span className="fr-stat-value" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="fr-stat-sub">{sub}</span>}
    </div>
  )
}

// Laporan follow-up di Analytics. data = respons GET /followup/report
export default function FollowupReport({ data, loading, rangeLabel }) {
  const t = data?.totals
  const lateDays = data?.alert_days ?? 2
  const steps = data?.steps || []
  const best = steps.reduce((b, s) => (s.converted > (b?.converted || 0) ? s : b), null)
  const objTotal = (data?.objections || []).reduce((n, o) => n + o.count, 0)
  const objMax = Math.max(1, ...(data?.objections || []).map(o => o.count))

  return (
    <div className="an-table-box fr">
      <div className="an-sec-head">
        <h3><ListChecks size={15} />Laporan Follow-up</h3>
        <span className="an-sec-right">Chat Penawaran / Follow-Up{rangeLabel ? ` · ${rangeLabel}` : ''}</span>
      </div>

      {loading ? <div className="an-skel" style={{ height: 160 }} /> : !t ? (
        <div className="an-chart-empty" style={{ height: 120 }}>Belum ada data follow-up</div>
      ) : (
        <>
          <div className="fr-stats">
            <MiniStat label="Follow-up dikerjakan" value={t.done} sub={`${t.running} chat sedang berjalan`} />
            <MiniStat label="Tepat waktu" value={pct(t.on_time_pct)} color={toneOf(t.on_time_pct)} sub={`${t.on_time} dari ${t.due} jatuh tempo`} />
            <MiniStat label="Dibalas customer" value={pct(t.replied_pct)} sub={`${t.replied} follow-up dibalas`} />
            <MiniStat label="Lanjut Survey/Deal" value={t.converted} color="#10b981" sub={`${t.deal} sudah Deal`} />
            <MiniStat label="Tidak jadi / Lost" value={t.lost} color={t.lost ? '#ef4444' : undefined} />
            <MiniStat label={`Terlambat >${lateDays} hari kerja`} value={t.late_alert} color={t.late_alert ? '#ef4444' : undefined} sub="saat ini" />
          </div>

          <div className="fr-grid">
            <div className="fr-box">
              <h4>Kepatuhan per Agent</h4>
              <div className="an-table-wrap">
                <table className="an-table fr-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th title="Tugas yang jatuh tempo di rentang ini (yang belum lewat hari jatuh tempo tidak dihitung)">Jatuh tempo</th>
                      <th>Tepat waktu</th>
                      <th title="Dikerjakan setelah hari jatuh tempo">Telat</th>
                      <th title="Lewat jatuh tempo dan belum dikerjakan">Belum</th>
                      <th>% Tepat waktu</th>
                      <th title={`Saat ini terlambat lebih dari ${lateDays} hari kerja`}>&gt;{lateDays} hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents.length === 0 ? (
                      <tr><td colSpan={7} className="fr-empty-cell">Belum ada agent</td></tr>
                    ) : data.agents.map(a => (
                      <tr key={a.agent_id || 'unassigned'}>
                        <td className="fr-name">{a.name}</td>
                        <td>{a.due}</td>
                        <td>{a.on_time}</td>
                        <td>{a.late_done}</td>
                        <td>{a.open_late}</td>
                        <td>
                          <div className="an-rate">
                            <div className="an-rate-bar"><div className="an-rate-fill" style={{ width: `${a.on_time_pct || 0}%`, background: toneOf(a.on_time_pct) }} /></div>
                            <span>{pct(a.on_time_pct)}</span>
                          </div>
                        </td>
                        <td>{a.late_alert ? <span className="fr-late"><AlertTriangle size={11} />{a.late_alert}</span> : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="fr-box">
              <h4>Alasan Keberatan</h4>
              {objTotal === 0 ? (
                <div className="an-chart-empty" style={{ height: 140 }}>Belum ada keberatan tercatat</div>
              ) : (
                <div className="fr-bars">
                  {data.objections.map(o => (
                    <div key={o.key} className="fr-bar-row">
                      <span className="fr-bar-lbl">{o.label}</span>
                      <div className="fr-bar-track"><div className="fr-bar-fill" style={{ width: `${(o.count / objMax) * 100}%` }} /></div>
                      <span className="fr-bar-val">{o.count} <small>({Math.round((o.count / objTotal) * 100)}%)</small></span>
                    </div>
                  ))}
                  <div className="fr-note">Dihitung per chat; satu chat bisa punya lebih dari satu alasan.</div>
                </div>
              )}
            </div>
          </div>

          <div className="fr-box">
            <h4>Hasil per Tahap</h4>
            <div className="an-table-wrap">
              <table className="an-table fr-table">
                <thead>
                  <tr>
                    <th>Tahap</th><th>Dikerjakan</th><th>Dibalas</th><th>Keberatan</th>
                    <th>Lanjut (Survey/Deal)</th><th>Deal</th><th>Lost</th><th>Konversi</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map(s => {
                    const info = STEP_INFO[s.step] || { label: s.label }
                    return (
                      <tr key={s.step}>
                        <td>
                          <span className="fr-step" style={{ background: info.color }}>{info.day ? `${info.day} · ` : ''}{info.label}</span>
                          {best && best.step === s.step && <span className="fr-best"><Trophy size={11} />Paling efektif</span>}
                        </td>
                        <td>{s.done}</td>
                        <td>{s.replied}{s.done ? <small className="fr-muted"> ({Math.round((s.replied / s.done) * 100)}%)</small> : null}</td>
                        <td>{s.objection}</td>
                        <td><span className="an-badge deal">{s.converted}</span></td>
                        <td>{s.deal}</td>
                        <td>{s.lost}</td>
                        <td>
                          <div className="an-rate">
                            <div className="an-rate-bar"><div className="an-rate-fill" style={{ width: `${s.converted_pct || 0}%`, background: '#10b981' }} /></div>
                            <span>{pct(s.converted_pct)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="fr-note">
              Lanjut/Lost dicatat pada tahap follow-up terakhir yang dikerjakan sebelum urutan berhenti (hasil "Tertarik lanjut" / "Tidak jadi", atau tag Survey/Deal/Fail).
              Konversi = Lanjut ÷ Dikerjakan.
              {t.pre_followup > 0 && ` ${t.pre_followup} chat lanjut ke Survey/Deal sebelum follow-up pertama dikerjakan.`}
            </div>
          </div>
        </>
      )}

      <style>{`
        .fr-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
        .fr-stat { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); min-width: 0; }
        .fr-stat-label { font-size: 11.5px; color: var(--text2); font-weight: 600; }
        .fr-stat-value { font-size: 22px; font-weight: 800; color: var(--text); line-height: 1.2; }
        .fr-stat-sub { font-size: 11px; color: var(--muted); }
        .fr-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 14px; margin-bottom: 14px; }
        .fr-box { border: 1px solid var(--border); border-radius: 12px; padding: 14px; min-width: 0; }
        .fr-box h4 { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
        .fr-table th, .fr-table td { padding: 8px 10px; white-space: nowrap; }
        .fr-name { font-weight: 600; }
        .fr-empty-cell { text-align: center; color: var(--muted); }
        .fr-late { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: #ef4444; }
        .fr-step { display: inline-block; color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; padding: 2px 8px; border-radius: 999px; }
        .fr-best { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-size: 10.5px; font-weight: 700; color: #d97706; background: rgba(245,158,11,0.18); padding: 1px 7px; border-radius: 999px; }
        .fr-muted { color: var(--muted); }
        .fr-bars { display: flex; flex-direction: column; gap: 9px; }
        .fr-bar-row { display: grid; grid-template-columns: 82px 1fr auto; align-items: center; gap: 10px; font-size: 12.5px; }
        .fr-bar-lbl { color: var(--text2); font-weight: 600; }
        .fr-bar-track { height: 10px; background: var(--surface3); border-radius: 5px; overflow: hidden; }
        .fr-bar-fill { height: 100%; background: #d97706; border-radius: 5px; }
        .fr-bar-val { font-weight: 700; color: var(--text); min-width: 58px; text-align: right; }
        .fr-bar-val small { font-weight: 500; color: var(--muted); }
        .fr-note { margin-top: 10px; font-size: 11.5px; color: var(--muted); line-height: 1.5; }
        @media (max-width: 1100px) { .fr-stats { grid-template-columns: repeat(3, 1fr); } .fr-grid { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .fr-stats { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  )
}

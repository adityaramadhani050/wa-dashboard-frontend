import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ListChecks, RefreshCw, MessageSquare, CheckCircle2, MapPin, UserCheck, Check, Settings2, X, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getFollowupTasks, getFollowupSummary, getFollowupSettings, saveFollowupSettings, getAgents } from '../hooks/useApi'
import FollowupCompleteModal from '../components/FollowupCompleteModal'
import { STEP_INFO, OBJECTION_LABEL, dueLabel, dueTone, fmtDate } from '../components/followupUi'

const TABS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'overdue', label: 'Terlambat' },
  { key: 'upcoming', label: 'Akan datang' },
  { key: 'done', label: 'Selesai' },
]
const TEMPLATE_KEYS = ['confirm', 'feedback', 'objection', 'values', 'reactivation', 'nurture']

function StepBadge({ step }) {
  const s = STEP_INFO[step] || { label: step }
  return <span className="fu-step" style={{ background: s.color || 'var(--primary)' }}>{s.day ? `${s.day} · ` : ''}{s.label}</span>
}

export default function FollowupPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'today')
  // Hanya tampilkan tugas yang terlambat > N hari kerja (tab Terlambat)
  const [onlyAlert, setOnlyAlert] = useState(() => searchParams.get('late') === '1')
  const [data, setData] = useState({ tasks: [], counts: {}, alert_days: 2, alert_count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [agents, setAgents] = useState([])
  const [summary, setSummary] = useState([])
  const [completeTarget, setCompleteTarget] = useState(null)
  // Template & pengaturan (admin)
  const [showSettings, setShowSettings] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [cfgBusy, setCfgBusy] = useState(false)
  const [cfgSaved, setCfgSaved] = useState(false)

  // Dibuka dari notifikasi / lonceng: /followup?tab=overdue&late=1
  useEffect(() => {
    const t = searchParams.get('tab')
    if (!t && !searchParams.get('late')) return
    if (TABS.some(x => x.key === t)) setTab(t)
    setOnlyAlert(searchParams.get('late') === '1')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const filters = isAdmin ? { agent_id: agentFilter || undefined, region: regionFilter || undefined } : {}

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [d, s] = await Promise.all([
        getFollowupTasks(tab, filters),
        isAdmin ? getFollowupSummary({ region: regionFilter || undefined }).catch(() => []) : Promise.resolve([]),
      ])
      setData({ tasks: d.tasks || [], counts: d.counts || {}, alert_days: d.alert_days ?? 2, alert_count: d.alert_count || 0 })
      setSummary(Array.isArray(s) ? s : [])
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal memuat follow-up. Pastikan SQL migrasi follow-up sudah dijalankan.')
    } finally { setLoading(false) }
  }, [tab, agentFilter, regionFilter, isAdmin]) // eslint-disable-line

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isAdmin) return
    getAgents().then(d => setAgents(Array.isArray(d) ? d.filter(a => a.role === 'agent') : [])).catch(() => {})
  }, [isAdmin])
  useEffect(() => {
    if (isAdmin && showSettings) getFollowupSettings().then(d => setCfg({ templates: d.templates, alert: d.alert || { enabled: true, late_days: 2 } })).catch(() => {})
  }, [isAdmin, showSettings])

  const saveSettings = async () => {
    setCfgBusy(true); setCfgSaved(false)
    try {
      const d = await saveFollowupSettings({ templates: cfg.templates, alert: { ...cfg.alert, late_days: Number(cfg.alert.late_days) || 2 } })
      setCfg({ templates: d.templates, alert: d.alert })
      setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2000)
      load()
    }
    catch (e) { alert(e?.response?.data?.error || 'Gagal menyimpan pengaturan') }
    finally { setCfgBusy(false) }
  }

  const lateDays = data.alert_days
  const lateAgents = summary.filter(s => s.late_alert > 0)
  const lateTotal = lateAgents.reduce((n, s) => n + s.late_alert, 0)
  const showOnlyAlert = tab === 'overdue' && onlyAlert
  const tasks = showOnlyAlert ? data.tasks.filter(t => t.alert) : data.tasks

  return (
    <div className="fu-page">
      <div className="fu-header">
        <div>
          <h1><ListChecks size={20} /> Follow-up</h1>
          <p>Tugas follow-up chat bertag Penawaran / Follow-Up setelah chat Resolved: H+1 CONFIRM · H+3 FEEDBACK · H+7 OBJECTION · H+14 VALUES · H+30 REACTIVATION.</p>
        </div>
        <div className="fu-header-actions">
          {isAdmin && <button className="fu-btn ghost" onClick={() => setShowSettings(true)}><Settings2 size={15} /> Template & pengaturan</button>}
          <button className="fu-btn ghost" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
        </div>
      </div>

      {isAdmin && lateTotal > 0 && (
        <div className="fu-alert">
          <AlertTriangle size={17} />
          <div className="fu-alert-text">
            <b>{lateTotal} tugas follow-up terlambat lebih dari {lateDays} hari kerja.</b>
            <span>{lateAgents.map(s => `${s.name} ${s.late_alert}`).join(' · ')}</span>
          </div>
          <button className="fu-btn sm danger" onClick={() => { setTab('overdue'); setOnlyAlert(true) }}>Lihat</button>
        </div>
      )}

      {isAdmin && summary.length > 0 && (
        <div className="fu-summary">
          {summary.map(s => (
            <button key={s.agent_id || 'none'} className={`fu-sum-card${agentFilter === (s.agent_id || 'unassigned') ? ' sel' : ''}`}
              onClick={() => setAgentFilter(agentFilter === (s.agent_id || 'unassigned') ? '' : (s.agent_id || 'unassigned'))}>
              <span className="fu-sum-name"><UserCheck size={13} />{s.name}</span>
              <span className="fu-sum-nums">
                <span className="today"><b>{s.today}</b> hari ini</span>
                <span className={s.overdue ? 'late' : ''}><b>{s.overdue}</b> terlambat</span>
                <span><b>{s.done_week}</b> selesai 7 hari</span>
                {s.late_alert > 0 && <span className="late"><AlertTriangle size={11} /><b>{s.late_alert}</b> &gt;{lateDays} hari</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="fu-toolbar">
        <div className="fu-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`fu-tab${tab === t.key ? ' active' : ''}${t.key === 'overdue' && data.counts.overdue ? ' alert' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="fu-count">{data.counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="fu-filters">
            {tab === 'overdue' && data.alert_count > 0 && (
              <button className={`fu-chip${onlyAlert ? ' on' : ''}`} onClick={() => setOnlyAlert(v => !v)}>
                <AlertTriangle size={12} /> &gt;{lateDays} hari kerja ({data.alert_count})
              </button>
            )}
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
              <option value="">Semua agent</option>
              <option value="unassigned">Belum di-assign</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="fu-seg">
              {[['', 'Semua'], ['barat', 'Barat'], ['timur', 'Timur']].map(([k, l]) => (
                <button key={k || 'all'} className={regionFilter === k ? `active ${k}` : ''} onClick={() => setRegionFilter(k)}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="fu-error">{error}</div>}

      {loading ? (
        <div className="fu-empty">Memuat…</div>
      ) : tasks.length === 0 ? (
        <div className="fu-empty">
          <CheckCircle2 size={34} strokeWidth={1.4} />
          <p>{showOnlyAlert ? `Tidak ada tugas yang terlambat lebih dari ${lateDays} hari kerja. 👍` : tab === 'today' ? 'Tidak ada follow-up hari ini.' : tab === 'overdue' ? 'Tidak ada follow-up yang terlambat. 👍' : tab === 'upcoming' ? 'Belum ada follow-up terjadwal.' : 'Belum ada follow-up yang diselesaikan.'}</p>
        </div>
      ) : (
        <div className="fu-list">
          {tasks.map(t => (
            <div key={t.id} className={`fu-row${t.alert ? ' alert' : ''}`}>
              <div className="fu-main">
                <div className="fu-line1">
                  <span className="fu-name">{t.conversation.contact_name}</span>
                  {t.conversation.region && <span className={`fu-region ${t.conversation.region}`}><MapPin size={10} />{t.conversation.region === 'barat' ? 'Barat' : 'Timur'}</span>}
                  {isAdmin && <span className="fu-agent"><UserCheck size={11} />{t.conversation.agent?.name || 'Belum di-assign'}</span>}
                </div>
                <div className="fu-line2">
                  <StepBadge step={t.step} />
                  {tab === 'done'
                    ? <span className="fu-due">Selesai {fmtDate(t.done_at)}</span>
                    : <span className={`fu-due ${dueTone(t)}`}>{dueLabel(t)}</span>}
                  {t.alert && <span className="fu-late-chip" title={`Terlambat ${t.late_days} hari kerja`}><AlertTriangle size={11} />{t.late_days} hari kerja</span>}
                </div>
                {tab === 'done' ? (
                  <div className="fu-last">
                    <b>{t.outcome_label}</b>{t.objection_category ? ` (${OBJECTION_LABEL[t.objection_category] || t.objection_category})` : ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                ) : t.step === 'manual' && t.note ? (
                  <div className="fu-last">Catatan: {t.note}</div>
                ) : t.last ? (
                  <div className="fu-last">
                    Terakhir ({t.last.step_label}): <b>{t.last.outcome_label}</b>
                    {t.last.objection_category ? ` (${OBJECTION_LABEL[t.last.objection_category] || t.last.objection_category})` : ''}
                    {t.last.note ? ` · ${t.last.note}` : ''}
                  </div>
                ) : null}
              </div>
              <div className="fu-actions">
                <button className="fu-btn ghost sm" onClick={() => navigate(`/chat/${t.conversation.id}`)}><MessageSquare size={14} /> Buka chat</button>
                {tab !== 'done' && (
                  <button className="fu-btn primary sm" onClick={() => setCompleteTarget(t)}><Check size={14} /> Sudah follow-up</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {completeTarget && (
        <FollowupCompleteModal
          task={completeTarget}
          conversationId={completeTarget.conversation.id}
          contactName={completeTarget.conversation.contact_name}
          onClose={() => setCompleteTarget(null)}
          onDone={() => { load(); window.dispatchEvent(new Event('fu:changed')) }}
        />
      )}

      {showSettings && (
        <div className="fus-overlay" onClick={() => setShowSettings(false)}>
          <div className="fus-modal" onClick={e => e.stopPropagation()}>
            <div className="fus-head">
              <div className="fus-title"><Settings2 size={17} /> Template & pengaturan follow-up</div>
              <button className="fus-close" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            {!cfg ? <div className="fu-empty sm">Memuat…</div> : (
              <div className="fus-body">
                <section className="fus-section">
                  <div className="fus-row">
                    <div>
                      <div className="fus-label">Peringatan keterlambatan ke admin</div>
                      <div className="fu-hint">Notifikasi dikirim ke semua admin sekali sehari di awal jam kerja (default 08:00 WIB), dan tampil di lonceng & halaman ini. Hari libur di pengaturan Jam & Hari Kerja tidak dihitung.</div>
                    </div>
                    <button className={`fus-switch${cfg.alert.enabled ? ' on' : ''}`} role="switch" aria-checked={cfg.alert.enabled}
                      onClick={() => setCfg({ ...cfg, alert: { ...cfg.alert, enabled: !cfg.alert.enabled } })}>
                      <span className="fus-knob" />
                    </button>
                  </div>
                  <div className={`fus-inline${cfg.alert.enabled ? '' : ' off'}`}>
                    Terlambat lebih dari
                    <input type="number" min={1} max={14} value={cfg.alert.late_days} disabled={!cfg.alert.enabled}
                      onChange={e => setCfg({ ...cfg, alert: { ...cfg.alert, late_days: e.target.value } })} />
                    hari kerja
                  </div>
                </section>
                <section className="fus-section">
                  <div className="fus-label">Template pesan per tahap</div>
                  <div className="fu-hint">Dipakai tombol "Pakai template" di chat. Variabel: {'{{nama}}'}. Bagian dalam [kurung siku] diisi agent sebelum dikirim.</div>
                  <div className="fu-tpl-grid">
                    {TEMPLATE_KEYS.map(k => (
                      <label key={k} className="fu-tpl-field">
                        <StepBadge step={k} />
                        <textarea rows={3} value={cfg.templates[k] || ''} onChange={e => setCfg({ ...cfg, templates: { ...cfg.templates, [k]: e.target.value } })} />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            )}
            <div className="fus-foot">
              <button className="fu-btn ghost" onClick={() => setShowSettings(false)}>Tutup</button>
              <button className="fu-btn primary" onClick={saveSettings} disabled={!cfg || cfgBusy}>
                {cfgSaved ? <><Check size={15} /> Tersimpan</> : cfgBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fu-page { padding: 24px 24px 48px; width: 100%; color: var(--text); }
        .fu-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .fu-header h1 { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; }
        .fu-header p { font-size: 13px; color: var(--text2); margin-top: 4px; max-width: 760px; line-height: 1.5; }
        .fu-header-actions { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
        .fu-btn.danger { background: var(--danger, #e53e3e); color: #fff; }
        .fu-alert { display: flex; align-items: center; gap: 12px; padding: 11px 14px; margin-bottom: 14px; border-radius: 11px; background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.35); color: var(--danger, #e53e3e); }
        .fu-alert-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
        .fu-alert-text span { color: var(--text2); font-size: 12px; }
        .fu-chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--danger, #e53e3e); background: var(--surface); border: 1px solid rgba(229,62,62,0.45); }
        .fu-chip.on { background: var(--danger, #e53e3e); color: #fff; border-color: var(--danger, #e53e3e); }
        .fu-row.alert { box-shadow: inset 3px 0 0 var(--danger, #e53e3e); }
        .fu-late-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 10px; color: var(--danger, #e53e3e); background: rgba(229,62,62,0.1); }
        .fu-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; white-space: nowrap; }
        .fu-btn.sm { padding: 6px 11px; font-size: 12.5px; }
        .fu-btn.primary { background: var(--primary); color: var(--on-primary); }
        .fu-btn.primary:disabled { opacity: .6; }
        .fu-btn.ghost { background: var(--surface); color: var(--text2); border: 1px solid var(--border); }
        .spin { animation: fu-spin 0.8s linear infinite; }
        @keyframes fu-spin { to { transform: rotate(360deg); } }
        .fu-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .fu-sum-card { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 12px; background: var(--surface); border: 1.5px solid var(--border); }
        .fu-sum-card.sel { border-color: var(--primary); background: var(--primary-light); }
        .fu-sum-name { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--text); }
        .fu-sum-nums { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11.5px; color: var(--muted); }
        .fu-sum-nums b { font-size: 14px; color: var(--text); }
        .fu-sum-nums .late b, .fu-sum-nums .late { color: var(--danger, #e53e3e); }
        .fu-sum-nums .late { display: inline-flex; align-items: center; gap: 3px; }
        .fu-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .fu-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .fu-tab { display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border); }
        .fu-tab.active { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
        .fu-count { font-size: 11px; font-weight: 700; padding: 0 7px; border-radius: 999px; background: var(--surface3); color: var(--text2); }
        .fu-tab.active .fu-count { background: rgba(255,255,255,0.25); color: var(--on-primary); }
        .fu-tab.alert:not(.active) .fu-count { background: var(--danger, #e53e3e); color: #fff; }
        .fu-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .fu-filters select { padding: 7px 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
        .fu-seg { display: inline-flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--surface); border: 1px solid var(--border); }
        .fu-seg button { padding: 5px 11px; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: var(--text2); }
        .fu-seg button.active { background: var(--primary); color: var(--on-primary); }
        .fu-seg button.active.barat { background: #2563eb; } .fu-seg button.active.timur { background: #d97706; }
        .fu-error { padding: 10px 14px; border-radius: 9px; background: rgba(229,62,62,0.08); color: var(--danger, #e53e3e); font-size: 13px; margin-bottom: 12px; }
        .fu-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 50px 0; color: var(--muted); font-size: 13.5px; }
        .fu-empty.sm { padding: 16px 0; }
        .fu-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
        .fu-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--border); }
        .fu-row:last-child { border-bottom: none; }
        .fu-main { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
        .fu-line1, .fu-line2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .fu-name { font-size: 14px; font-weight: 700; color: var(--text); }
        .fu-agent { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: rgba(39,168,122,0.1); color: var(--success); }
        .fu-region { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 10px; }
        .fu-region.barat { color: #2563eb; background: rgba(37,99,235,0.12); } .fu-region.timur { color: #d97706; background: rgba(217,119,6,0.12); }
        .fu-step { color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
        .fu-due { font-size: 12px; font-weight: 600; color: var(--text2); }
        .fu-due.today { color: #d97706; } .fu-due.late { color: var(--danger, #e53e3e); } .fu-due.wait { color: var(--muted); font-style: italic; }
        .fu-last { font-size: 12px; color: var(--muted); line-height: 1.45; }
        .fu-last b { color: var(--text2); font-weight: 600; }
        .fu-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .fu-hint { font-size: 12px; color: var(--muted); }
        .fu-tpl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
        .fu-tpl-field { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
        .fus-overlay { position: fixed; inset: 0; z-index: 600; background: var(--scrim, rgba(0,0,0,0.5)); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .fus-modal { width: 100%; max-width: 760px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .fus-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--border); }
        .fus-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text); }
        .fus-close { color: var(--muted); }
        .fus-body { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 18px; }
        .fus-section { display: flex; flex-direction: column; gap: 10px; }
        .fus-section + .fus-section { padding-top: 16px; border-top: 1px solid var(--border); }
        .fus-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .fus-label { font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
        .fus-inline { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); }
        .fus-inline.off { opacity: .55; }
        .fus-inline input { width: 64px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--text); font-size: 13px; text-align: center; }
        .fus-switch { position: relative; width: 46px; height: 26px; border-radius: 999px; background: var(--muted); flex-shrink: 0; transition: background 0.2s; }
        .fus-switch.on { background: var(--success); }
        .fus-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--on-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s; }
        .fus-switch.on .fus-knob { transform: translateX(20px); }
        .fus-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); }
        .fu-tpl-field textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
        @media (max-width: 760px) {
          .fu-page { padding: 16px 14px 40px; }
          .fu-header { flex-direction: column; }
          .fu-row { flex-direction: column; align-items: stretch; }
          .fu-actions { justify-content: flex-end; }
          .fu-tpl-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

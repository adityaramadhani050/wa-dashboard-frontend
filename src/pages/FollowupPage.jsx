import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, RefreshCw, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, MapPin, UserCheck, Check } from 'lucide-react'
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
  const [tab, setTab] = useState('today')
  const [data, setData] = useState({ tasks: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [agents, setAgents] = useState([])
  const [summary, setSummary] = useState([])
  const [completeTarget, setCompleteTarget] = useState(null)
  // Template (admin)
  const [showTpl, setShowTpl] = useState(false)
  const [tpl, setTpl] = useState(null)
  const [tplBusy, setTplBusy] = useState(false)
  const [tplSaved, setTplSaved] = useState(false)

  const filters = isAdmin ? { agent_id: agentFilter || undefined, region: regionFilter || undefined } : {}

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [d, s] = await Promise.all([
        getFollowupTasks(tab, filters),
        isAdmin ? getFollowupSummary({ region: regionFilter || undefined }).catch(() => []) : Promise.resolve([]),
      ])
      setData({ tasks: d.tasks || [], counts: d.counts || {} })
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
    if (isAdmin && showTpl && !tpl) getFollowupSettings().then(d => setTpl(d.templates)).catch(() => {})
  }, [isAdmin, showTpl, tpl])

  const saveTemplates = async () => {
    setTplBusy(true); setTplSaved(false)
    try { const d = await saveFollowupSettings(tpl); setTpl(d.templates); setTplSaved(true); setTimeout(() => setTplSaved(false), 2000) }
    catch (e) { alert(e?.response?.data?.error || 'Gagal menyimpan template') }
    finally { setTplBusy(false) }
  }

  return (
    <div className="fu-page">
      <div className="fu-header">
        <div>
          <h1><ListChecks size={20} /> Follow-up</h1>
          <p>Tugas follow-up chat bertag Penawaran / Follow-Up setelah chat Resolved: H+1 CONFIRM · H+3 FEEDBACK · H+7 OBJECTION · H+14 VALUES · H+30 REACTIVATION.</p>
        </div>
        <button className="fu-btn ghost" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
      </div>

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
      ) : data.tasks.length === 0 ? (
        <div className="fu-empty">
          <CheckCircle2 size={34} strokeWidth={1.4} />
          <p>{tab === 'today' ? 'Tidak ada follow-up hari ini.' : tab === 'overdue' ? 'Tidak ada follow-up yang terlambat. 👍' : tab === 'upcoming' ? 'Belum ada follow-up terjadwal.' : 'Belum ada follow-up yang diselesaikan.'}</p>
        </div>
      ) : (
        <div className="fu-list">
          {data.tasks.map(t => (
            <div key={t.id} className="fu-row">
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

      {isAdmin && (
        <div className="fu-tpl">
          <button className="fu-tpl-head" onClick={() => setShowTpl(s => !s)}>
            <span>Template pesan per tahap</span>{showTpl ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showTpl && (tpl ? (
            <div className="fu-tpl-body">
              <p className="fu-hint">Dipakai tombol "Pakai template" di chat. Variabel: {'{{nama}}'}. Bagian dalam [kurung siku] diisi agent sebelum dikirim.</p>
              <div className="fu-tpl-grid">
                {TEMPLATE_KEYS.map(k => (
                  <label key={k} className="fu-tpl-field">
                    <StepBadge step={k} />
                    <textarea rows={3} value={tpl[k] || ''} onChange={e => setTpl({ ...tpl, [k]: e.target.value })} />
                  </label>
                ))}
              </div>
              <button className="fu-btn primary" onClick={saveTemplates} disabled={tplBusy}>
                {tplSaved ? <><Check size={15} /> Tersimpan</> : tplBusy ? 'Menyimpan…' : 'Simpan template'}
              </button>
            </div>
          ) : <div className="fu-empty sm">Memuat template…</div>)}
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

      <style>{`
        .fu-page { padding: 24px 24px 48px; width: 100%; color: var(--text); }
        .fu-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .fu-header h1 { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; }
        .fu-header p { font-size: 13px; color: var(--text2); margin-top: 4px; max-width: 760px; line-height: 1.5; }
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
        .fu-tpl { margin-top: 18px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; }
        .fu-tpl-head { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; font-size: 14px; font-weight: 700; color: var(--text); }
        .fu-tpl-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
        .fu-hint { font-size: 12px; color: var(--muted); }
        .fu-tpl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
        .fu-tpl-field { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
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

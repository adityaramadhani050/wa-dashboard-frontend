import { useState, useEffect } from 'react'
import { Check, Sparkles, FileText, Clock, SkipForward } from 'lucide-react'
import { getFollowupSettings, generateFollowupDraft } from '../hooks/useApi'
import FollowupCompleteModal from './FollowupCompleteModal'
import { STEP_ORDER, STEP_INFO, OBJECTION_LABEL, dueLabel, dueTone, fmtDate, fillName } from './followupUi'

let templatesCache = null

const STOP_REASON = {
  'outcome:interested': 'customer tertarik lanjut',
  'outcome:lost': 'customer tidak jadi',
  trigger_removed: 'tag Penawaran/Follow-Up dilepas',
}

// Bagian Follow-up di panel samping chat (Catatan & Riwayat).
// data = respons GET /followup/conversation/:id
export default function FollowupPanel({ data, conversationId, contactName, onInsertText, onChanged }) {
  const [templates, setTemplates] = useState(templatesCache)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    if (!templatesCache) getFollowupSettings().then(d => { templatesCache = d.templates; setTemplates(d.templates) }).catch(() => {})
  }, [])

  const seq = data?.sequence
  const current = data?.current
  const run = data?.run || []
  const history = data?.history || []

  const stepState = (key) => {
    const t = [...run].reverse().find(x => x.step === key)
    if (!t) return 'next'
    if (t.status === 'done') return 'done'
    if (t.status === 'skipped') return 'skipped'
    if (t.status === 'pending' || t.status === 'paused') return 'current'
    return 'next'
  }
  const nurtureDone = run.filter(t => t.step === 'nurture' && t.status === 'done').length

  const useTemplate = () => {
    const tpl = templates?.[current?.step]
    if (!tpl) return
    onInsertText(fillName(tpl, contactName))
  }
  const makeDraft = async () => {
    if (!current || drafting) return
    setDrafting(true); setError('')
    try {
      const { draft } = await generateFollowupDraft(conversationId, current.step === 'manual' ? 'confirm' : current.step)
      if (draft) onInsertText(draft)
    } catch (e) {
      setError(e?.response?.status === 429 ? 'Kuota AI sedang penuh, coba lagi.' : (e?.response?.data?.error || 'Gagal membuat draf AI.'))
    } finally { setDrafting(false) }
  }

  const step = current ? (STEP_INFO[current.step] || { label: current.step_label }) : null

  return (
    <div className="fup">
      <div className="fup-head">Follow-up</div>

      {!seq && !current ? (
        <div className="fup-empty">Belum ada follow-up untuk chat ini. Pasang tag <b>Follow-Up</b> atau <b>Penawaran</b>; urutan dimulai otomatis saat chat Resolved.</div>
      ) : (
        <>
          {seq && seq.status !== 'stopped' && (
            <div className="fup-steps">
              {STEP_ORDER.map(k => {
                const st = stepState(k)
                const info = STEP_INFO[k]
                return (
                  <div key={k} className={`fup-step ${st}`} title={info.label}>
                    <span className="fup-dot" style={st === 'current' ? { background: info.color, borderColor: info.color } : undefined}>
                      {st === 'done' ? <Check size={10} /> : st === 'skipped' ? <SkipForward size={9} /> : null}
                    </span>
                    <span className="fup-step-day">{info.day}</span>
                  </div>
                )
              })}
              {nurtureDone > 0 && <span className="fup-nurture">+{nurtureDone} nurture</span>}
            </div>
          )}

          {seq?.status === 'waiting' && <div className="fup-info"><Clock size={13} /> Menunggu chat Resolved untuk memulai (H+1 CONFIRM).</div>}
          {seq?.status === 'stopped' && !current && (
            <div className="fup-info done"><Check size={13} /> Follow-up selesai{seq.stop_reason ? ` — ${STOP_REASON[seq.stop_reason] || seq.stop_reason.replace(/^tag:/, 'tag ')}` : ''}.</div>
          )}

          {current && (
            <div className="fup-current">
              <div className="fup-current-top">
                <span className="fup-badge" style={{ background: step.color || 'var(--primary)' }}>{step.day ? `${step.day} · ` : ''}{step.label}</span>
                <span className={`fup-due ${dueTone(current)}`}>{dueLabel(current)}</span>
              </div>
              {current.status === 'paused' && <div className="fup-note">Customer sedang membalas — jadwal dihitung ulang saat chat Resolved lagi.</div>}
              {current.step === 'manual' && current.note && <div className="fup-note">Catatan: {current.note}</div>}
              <div className="fup-actions">
                {current.step !== 'manual' && (
                  <button className="fup-btn" onClick={useTemplate} disabled={!templates}><FileText size={13} /> Pakai template</button>
                )}
                <button className="fup-btn" onClick={makeDraft} disabled={drafting}><Sparkles size={13} /> {drafting ? 'Membuat…' : 'Buat draf AI'}</button>
                <button className="fup-btn primary" onClick={() => setShowComplete(true)}><Check size={13} /> Sudah follow-up</button>
              </div>
              {error && <div className="fup-error">{error}</div>}
            </div>
          )}

          {history.length > 0 && (
            <div className="fup-history">
              <div className="fup-history-lbl">Riwayat</div>
              {history.slice(0, 8).map(h => (
                <div key={h.id} className="fup-history-item">
                  <span className="fup-history-step">{STEP_INFO[h.step]?.label || h.step_label}</span>
                  <span className="fup-history-text">
                    <b>{h.outcome_label}</b>{h.objection_category ? ` (${OBJECTION_LABEL[h.objection_category] || h.objection_category})` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </span>
                  <span className="fup-history-date">{fmtDate(h.done_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showComplete && current && (
        <FollowupCompleteModal
          task={current}
          conversationId={conversationId}
          contactName={contactName}
          onClose={() => setShowComplete(false)}
          onDone={() => { onChanged?.(); window.dispatchEvent(new Event('fu:changed')) }}
        />
      )}

      <style>{`
        .fup { width: 100%; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .fup-head { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .fup-empty { padding-top: 6px; font-size: 12.5px; color: var(--text2); line-height: 1.5; }
        .fup-steps { display: flex; align-items: flex-start; gap: 4px; padding: 10px 0 2px; }
        .fup-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; }
        .fup-step:not(:last-of-type)::after { content: ''; position: absolute; top: 8px; left: calc(50% + 10px); right: calc(-50% + 10px); height: 2px; background: var(--border); }
        .fup-step.done:not(:last-of-type)::after, .fup-step.skipped:not(:last-of-type)::after { background: var(--success, #10b981); opacity: .5; }
        .fup-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; color: #fff; background: var(--surface); }
        .fup-step.done .fup-dot { background: var(--success, #10b981); border-color: var(--success, #10b981); }
        .fup-step.skipped .fup-dot { background: var(--muted); border-color: var(--muted); }
        .fup-step-day { font-size: 10px; font-weight: 700; color: var(--muted); }
        .fup-step.current .fup-step-day { color: var(--text); }
        .fup-nurture { align-self: center; font-size: 10px; font-weight: 700; color: #0891b2; white-space: nowrap; }
        .fup-info { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--text2); }
        .fup-info.done { color: var(--success, #10b981); font-weight: 600; }
        .fup-current { margin-top: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface2); display: flex; flex-direction: column; gap: 8px; }
        .fup-current-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .fup-badge { color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; padding: 2px 8px; border-radius: 999px; }
        .fup-due { font-size: 11.5px; font-weight: 700; color: var(--text2); }
        .fup-due.today { color: #d97706; } .fup-due.late { color: var(--danger, #e53e3e); } .fup-due.wait { color: var(--muted); font-weight: 600; font-style: italic; }
        .fup-note { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
        .fup-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .fup-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; background: var(--surface); color: var(--text2); border: 1px solid var(--border); }
        .fup-btn:disabled { opacity: .6; }
        .fup-btn.primary { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
        .fup-error { font-size: 11.5px; color: var(--danger, #e53e3e); }
        .fup-history { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
        .fup-history-lbl { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
        .fup-history-item { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: baseline; font-size: 11.5px; }
        .fup-history-step { font-weight: 800; font-size: 10px; color: var(--text2); }
        .fup-history-text { color: var(--muted); min-width: 0; }
        .fup-history-text b { color: var(--text2); font-weight: 600; }
        .fup-history-date { color: var(--muted); font-size: 10.5px; white-space: nowrap; }
      `}</style>
    </div>
  )
}

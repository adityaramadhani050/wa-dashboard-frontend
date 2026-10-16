import { useState, useEffect } from 'react'
import { Check, Sparkles, FileText, Clock, Minus, ListChecks, XCircle, CheckCircle2 } from 'lucide-react'
import { getFollowupSettings, generateFollowupDraft } from '../hooks/useApi'
import FollowupCompleteModal from './FollowupCompleteModal'
import { STEP_ORDER, STEP_INFO, OBJECTION_LABEL, dueLabel, dueTone, fmtDate, fillName } from './followupUi'

let templatesCache = null

const STOP_REASON = {
  'outcome:interested': 'customer tertarik lanjut',
  'outcome:lost': 'customer tidak jadi',
  trigger_removed: 'tag Penawaran/Follow-Up dilepas',
}

// Nada hasil akhir urutan: lanjut (hijau) / lost (merah) / berhenti (netral)
function stopTone(reason = '') {
  const r = reason.replace(/^tag:/, '')
  if (reason === 'outcome:interested' || /surv|\bdeal\b/i.test(r)) return 'ok'
  if (reason === 'outcome:lost' || /fail|gagal|batal|lost/i.test(r)) return 'lost'
  return 'muted'
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
  const tone = seq?.status === 'stopped' ? stopTone(seq.stop_reason || '') : null
  const showTemplate = current && current.step !== 'manual'

  // Status ringkas di judul bagian
  let pill = null
  if (current) pill = { cls: dueTone(current), text: dueLabel(current) }
  else if (seq?.status === 'waiting') pill = { cls: 'wait', text: 'Menunggu Resolved' }
  else if (seq?.status === 'stopped') pill = { cls: tone, text: tone === 'ok' ? 'Lanjut' : tone === 'lost' ? 'Lost' : 'Berhenti' }

  return (
    <section className="cv-ns fup">
      <div className="cv-ns-head">
        <span className="cv-ns-title"><ListChecks size={13} />Follow-up</span>
        {pill && <span className={`fup-pill ${pill.cls}`}>{pill.text}</span>}
      </div>

      {!seq && !current ? (
        <div className="fup-empty">Belum ada follow-up. Pasang label <b>Follow-Up</b> atau <b>Penawaran</b>; urutan dimulai otomatis saat chat Resolved.</div>
      ) : (
        <>
          {seq && seq.status !== 'stopped' && (
            <div className="fup-steps">
              {STEP_ORDER.map(k => {
                const st = stepState(k)
                const info = STEP_INFO[k]
                return (
                  <div key={k} className={`fup-step ${st}`} title={info.label}>
                    <span className="fup-dot" style={st === 'current' ? { borderColor: info.color, boxShadow: `0 0 0 3px ${info.color}33` } : undefined}>
                      {st === 'done' ? <Check size={11} strokeWidth={3} /> : st === 'skipped' ? <Minus size={11} strokeWidth={3} />
                        : st === 'current' ? <span className="fup-dot-core" style={{ background: info.color }} /> : null}
                    </span>
                    <span className="fup-step-day">{info.day}</span>
                  </div>
                )
              })}
              {nurtureDone > 0 && <span className="fup-nurture">+{nurtureDone} nurture</span>}
            </div>
          )}

          {seq?.status === 'waiting' && (
            <div className="fup-info muted"><Clock size={14} /><span>Dimulai otomatis saat chat Resolved (H+1 CONFIRM).</span></div>
          )}
          {seq?.status === 'stopped' && !current && (
            <div className={`fup-info ${tone}`}>
              {tone === 'lost' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
              <span>Follow-up selesai{seq.stop_reason ? ` — ${STOP_REASON[seq.stop_reason] || seq.stop_reason.replace(/^tag:/, 'label ')}` : ''}.</span>
            </div>
          )}

          {current && (
            <div className="fup-current">
              <div className="fup-current-top">
                <span className="fup-badge" style={{ background: step.color || 'var(--primary)' }}>{step.day ? `${step.day} · ` : ''}{step.label}</span>
                <span className="fup-current-date">{current.due_at && current.status !== 'paused' ? fmtDate(current.due_at) : ''}</span>
              </div>
              {current.status === 'paused' && <div className="fup-note">Customer sedang membalas — jadwal dihitung ulang saat chat Resolved lagi.</div>}
              {current.step === 'manual' && current.note && <div className="fup-note">Catatan: {current.note}</div>}
              <div className={`fup-actions${showTemplate ? '' : ' single'}`}>
                {showTemplate && (
                  <button className="fup-btn" onClick={useTemplate} disabled={!templates}><FileText size={14} /> Template</button>
                )}
                <button className="fup-btn ai" onClick={makeDraft} disabled={drafting}><Sparkles size={14} /> {drafting ? 'Membuat…' : 'Draf AI'}</button>
                <button className="fup-btn primary" onClick={() => setShowComplete(true)}><Check size={14} /> Sudah follow-up</button>
              </div>
              {error && <div className="fup-error">{error}</div>}
            </div>
          )}

          {history.length > 0 && (
            <div className="fup-history">
              <div className="fup-history-lbl">Riwayat follow-up</div>
              <div className="fup-tl">
                {history.slice(0, 8).map(h => {
                  const info = STEP_INFO[h.step] || { label: h.step_label }
                  return (
                    <div key={h.id} className="fup-tl-item">
                      <span className="fup-tl-dot" style={{ background: info.color || 'var(--muted)' }} />
                      <div className="fup-tl-top">
                        <span className="fup-tl-step" style={{ color: info.color }}>{info.day ? `${info.day} · ` : ''}{info.label}</span>
                        <span className="fup-tl-date">{fmtDate(h.done_at)}</span>
                      </div>
                      <div className="fup-tl-outcome">
                        {h.outcome_label}
                        {h.objection_category && <span className="fup-tl-chip">{OBJECTION_LABEL[h.objection_category] || h.objection_category}</span>}
                      </div>
                      {h.note && <div className="fup-tl-note">{h.note}</div>}
                    </div>
                  )
                })}
              </div>
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
        .fup-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--surface3); color: var(--text2); white-space: nowrap; }
        .fup-pill.today { background: rgba(217,119,6,0.14); color: #d97706; }
        .fup-pill.late, .fup-pill.lost { background: rgba(229,62,62,0.12); color: var(--danger, #e53e3e); }
        .fup-pill.ok { background: rgba(16,185,129,0.14); color: var(--success, #10b981); }
        .fup-pill.later { background: var(--primary-light); color: var(--primary); }
        .fup-pill.wait, .fup-pill.muted { background: var(--surface3); color: var(--muted); }
        .fup-empty { padding: 9px 11px; border-radius: 10px; border: 1px dashed var(--border); font-size: 12.5px; color: var(--text2); line-height: 1.55; }
        .fup-steps { display: flex; align-items: flex-start; padding: 2px 0; }
        .fup-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; position: relative; }
        .fup-step:not(:last-of-type)::after { content: ''; position: absolute; top: 10px; left: calc(50% + 13px); right: calc(-50% + 13px); height: 2px; border-radius: 2px; background: var(--border); }
        .fup-step.done:not(:last-of-type)::after { background: var(--success, #10b981); }
        .fup-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; color: #fff; background: var(--surface); position: relative; z-index: 1; }
        .fup-dot-core { width: 8px; height: 8px; border-radius: 50%; }
        .fup-step.done .fup-dot { background: var(--success, #10b981); border-color: var(--success, #10b981); }
        .fup-step.skipped .fup-dot { background: var(--surface3); border-color: var(--surface3); color: var(--muted); }
        .fup-step-day { font-size: 10.5px; font-weight: 700; color: var(--muted); }
        .fup-step.current .fup-step-day { color: var(--text); }
        .fup-nurture { align-self: center; margin-left: 6px; font-size: 10.5px; font-weight: 700; color: #0891b2; white-space: nowrap; }
        .fup-info { display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px; border-radius: 10px; font-size: 12.5px; line-height: 1.45; border: 1px solid var(--border); background: var(--surface2); color: var(--text2); }
        .fup-info svg { flex-shrink: 0; margin-top: 1px; }
        .fup-info.ok { color: var(--success, #10b981); background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); }
        .fup-info.lost { color: var(--danger, #e53e3e); background: rgba(229,62,62,0.07); border-color: rgba(229,62,62,0.25); }
        .fup-info.muted { color: var(--text2); }
        .fup-current { padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface2); display: flex; flex-direction: column; gap: 10px; }
        .fup-current-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .fup-current-date { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
        .fup-badge { color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .fup-note { font-size: 12px; color: var(--muted); line-height: 1.45; }
        .fup-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .fup-actions.single { grid-template-columns: 1fr; }
        .fup-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 9px; font-size: 12.5px; font-weight: 600; background: var(--surface); color: var(--text2); border: 1px solid var(--border); white-space: nowrap; transition: background 0.15s, border-color 0.15s; }
        .fup-btn:hover:not(:disabled) { background: var(--surface3); }
        .fup-btn:disabled { opacity: .6; }
        .fup-btn.ai { color: #7c5cd6; }
        .fup-btn.primary { grid-column: 1 / -1; background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
        .fup-btn.primary:hover:not(:disabled) { background: var(--primary-hover, var(--primary)); }
        .fup-error { font-size: 12px; color: var(--danger, #e53e3e); }
        .fup-history { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
        .fup-history-lbl { font-size: 11px; font-weight: 600; color: var(--muted); }
        .fup-tl { position: relative; display: flex; flex-direction: column; gap: 12px; padding-left: 18px; }
        .fup-tl-item:not(:last-child)::before { content: ''; position: absolute; left: -14px; top: 14px; bottom: -10px; width: 2px; border-radius: 2px; background: var(--border); }
        .fup-tl-item { position: relative; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .fup-tl-dot { position: absolute; left: -18px; top: 4px; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 3px var(--surface); }
        .fup-tl-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .fup-tl-step { font-size: 10.5px; font-weight: 800; letter-spacing: .3px; }
        .fup-tl-date { font-size: 11px; color: var(--muted); white-space: nowrap; }
        .fup-tl-outcome { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; font-weight: 600; color: var(--text); }
        .fup-tl-chip { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: rgba(217,119,6,0.14); color: #d97706; }
        .fup-tl-note { font-size: 12px; color: var(--text2); line-height: 1.45; overflow-wrap: anywhere; }
      `}</style>
    </section>
  )
}

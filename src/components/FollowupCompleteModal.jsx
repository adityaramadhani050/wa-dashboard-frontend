import { useState } from 'react'
import { X, Check, Tag as TagIcon } from 'lucide-react'
import { completeFollowupTask, getTags, addTagToConversation } from '../hooks/useApi'
import { STEP_INFO, OBJECTION_LABEL } from './followupUi'

const OUTCOMES = [
  { key: 'no_reply', label: 'Tidak dibalas', hint: 'Lanjut ke tahap berikutnya' },
  { key: 'considering', label: 'Dibalas, masih pertimbangan', hint: 'Lanjut ke tahap berikutnya' },
  { key: 'objection', label: 'Keberatan', hint: 'Pilih alasannya' },
  { key: 'later', label: 'Minta dihubungi nanti', hint: 'Pilih tanggal' },
  { key: 'interested', label: 'Tertarik lanjut (Survey/Deal)', hint: 'Follow-up selesai' },
  { key: 'lost', label: 'Tidak jadi / Lost', hint: 'Follow-up selesai' },
]

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000)
  return d.toISOString().slice(0, 10)
}

// Modal "Sudah follow-up": hasil wajib dipilih.
export default function FollowupCompleteModal({ task, conversationId, contactName, onClose, onDone }) {
  const [outcome, setOutcome] = useState('')
  const [objection, setObjection] = useState('')
  const [nextDate, setNextDate] = useState(tomorrow())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggest, setSuggest] = useState(null) // { kind, tags: [] } setelah urutan berhenti
  const [tagBusy, setTagBusy] = useState(false)

  const step = STEP_INFO[task?.step] || { label: task?.step_label || task?.step }
  const valid = outcome && (outcome !== 'objection' || objection) && (outcome !== 'later' || nextDate)

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      const payload = { outcome, note: note.trim() || undefined }
      if (outcome === 'objection') payload.objection_category = objection
      if (outcome === 'later') payload.next_contact_at = new Date(`${nextDate}T09:00:00+07:00`).toISOString()
      const res = await completeFollowupTask(task.id, payload)
      if (res?.stopped) {
        // Tawarkan memasang tag yang sesuai (Survey/Deal atau Fail)
        const all = await getTags().catch(() => [])
        const re = res.stopped === 'interested' ? /surv|\bdeal\b/i : /fail|gagal|batal|lost/i
        const tags = (Array.isArray(all) ? all : []).filter(t => re.test(t.name || ''))
        if (tags.length && conversationId) { setSuggest({ kind: res.stopped, tags }); onDone?.(res); return }
      }
      onDone?.(res)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal menyimpan hasil follow-up')
    } finally { setSaving(false) }
  }

  const applyTag = async (tag) => {
    setTagBusy(true)
    try { await addTagToConversation(conversationId, tag.id) } catch { /* abaikan */ }
    finally { setTagBusy(false); onClose() }
  }

  return (
    <div className="fuc-overlay" onClick={onClose}>
      <div className="fuc-modal" onClick={e => e.stopPropagation()}>
        <div className="fuc-head">
          <div>
            <div className="fuc-title">Sudah follow-up</div>
            <div className="fuc-sub">
              <span className="fuc-step" style={{ background: step.color || 'var(--primary)' }}>{step.day ? `${step.day} · ` : ''}{step.label}</span>
              {contactName && <span>{contactName}</span>}
            </div>
          </div>
          <button className="fuc-close" onClick={onClose}><X size={18} /></button>
        </div>

        {suggest ? (
          <div className="fuc-body">
            <div className="fuc-done"><Check size={16} /> Hasil tersimpan. Urutan follow-up chat ini selesai.</div>
            <div className="fuc-label">{suggest.kind === 'interested' ? 'Pasang tag tahap berikutnya?' : 'Pasang tag Fail?'}</div>
            <div className="fuc-chips">
              {suggest.tags.map(t => (
                <button key={t.id} className="fuc-tagbtn" style={{ borderColor: t.color, color: t.color }} disabled={tagBusy} onClick={() => applyTag(t)}>
                  <TagIcon size={12} />{t.name}
                </button>
              ))}
            </div>
            <div className="fuc-actions"><button className="fuc-btn ghost" onClick={onClose}>Nanti saja</button></div>
          </div>
        ) : (
          <div className="fuc-body">
            <div className="fuc-label">Hasil follow-up <span className="fuc-req">*</span></div>
            <div className="fuc-outcomes">
              {OUTCOMES.map(o => (
                <label key={o.key} className={`fuc-outcome${outcome === o.key ? ' sel' : ''}`}>
                  <input type="radio" name="fu-outcome" checked={outcome === o.key} onChange={() => setOutcome(o.key)} />
                  <span className="fuc-outcome-text"><b>{o.label}</b><small>{o.hint}</small></span>
                </label>
              ))}
            </div>

            {outcome === 'objection' && (
              <>
                <div className="fuc-label">Alasan keberatan <span className="fuc-req">*</span></div>
                <div className="fuc-chips">
                  {Object.entries(OBJECTION_LABEL).map(([k, l]) => (
                    <button key={k} type="button" className={`fuc-chip${objection === k ? ' sel' : ''}`} onClick={() => setObjection(k)}>{l}</button>
                  ))}
                </div>
              </>
            )}
            {outcome === 'later' && (
              <>
                <div className="fuc-label">Hubungi kembali tanggal <span className="fuc-req">*</span></div>
                <input className="fuc-input" type="date" min={tomorrow()} value={nextDate} onChange={e => setNextDate(e.target.value)} />
              </>
            )}

            <div className="fuc-label">Catatan (opsional)</div>
            <textarea className="fuc-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="mis. minta revisi kapasitas jadi 5 kWp" />

            {error && <div className="fuc-error">{error}</div>}
            <div className="fuc-actions">
              <button className="fuc-btn ghost" onClick={onClose}>Batal</button>
              <button className="fuc-btn primary" disabled={!valid || saving} onClick={submit}>
                {saving ? 'Menyimpan…' : 'Simpan hasil'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .fuc-overlay { position: fixed; inset: 0; z-index: 600; background: var(--scrim, rgba(0,0,0,0.5)); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .fuc-modal { width: 100%; max-width: 440px; max-height: calc(100vh - 32px); overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .fuc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .fuc-title { font-size: 15px; font-weight: 700; color: var(--text); }
        .fuc-sub { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12.5px; color: var(--text2); flex-wrap: wrap; }
        .fuc-step { color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .3px; padding: 2px 8px; border-radius: 999px; }
        .fuc-close { color: var(--muted); }
        .fuc-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
        .fuc-label { font-size: 12.5px; font-weight: 700; color: var(--text2); margin-top: 4px; }
        .fuc-req { color: var(--danger, #e53e3e); }
        .fuc-outcomes { display: flex; flex-direction: column; gap: 6px; }
        .fuc-outcome { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer; background: var(--surface2); }
        .fuc-outcome.sel { border-color: var(--primary); background: var(--primary-light); }
        .fuc-outcome input { accent-color: var(--primary); width: 16px; height: 16px; flex-shrink: 0; }
        .fuc-outcome-text { display: flex; flex-direction: column; }
        .fuc-outcome-text b { font-size: 13px; color: var(--text); font-weight: 600; }
        .fuc-outcome-text small { font-size: 11px; color: var(--muted); }
        .fuc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .fuc-chip { padding: 6px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; border: 1.5px solid var(--border); background: var(--surface2); color: var(--text2); }
        .fuc-chip.sel { border-color: #d97706; color: #d97706; background: rgba(217,119,6,0.1); }
        .fuc-input { width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
        .fuc-error { font-size: 12.5px; color: var(--danger, #e53e3e); }
        .fuc-done { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--success, #10b981); }
        .fuc-tagbtn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; border: 1.5px solid; background: transparent; }
        .fuc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
        .fuc-btn { padding: 9px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; }
        .fuc-btn.primary { background: var(--primary); color: var(--on-primary); }
        .fuc-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
        .fuc-btn.ghost { background: var(--surface3); color: var(--text2); }
      `}</style>
    </div>
  )
}

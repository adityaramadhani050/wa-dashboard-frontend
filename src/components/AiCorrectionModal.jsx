import { useState } from 'react'
import { GraduationCap, X, CheckCircle2 } from 'lucide-react'
import { createAiLesson } from '../hooks/useApi'

// Admin mengoreksi satu balasan AI Sales -> jadi pelajaran untuk chat berikutnya.
export default function AiCorrectionModal({ msg, onClose }) {
  const [better, setBetter] = useState(msg?.body || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (!better.trim() || better.trim() === (msg.body || '').trim()) { setError('Tulis versi balasan yang lebih tepat.'); return }
    setBusy(true); setError('')
    try { await createAiLesson({ message_id: msg.id, better_reply: better, note }); setDone(true) }
    catch (err) { setError(err?.response?.data?.error || 'Gagal menyimpan koreksi') }
    finally { setBusy(false) }
  }

  return (
    <div className="acm-overlay" onClick={onClose}>
      <form className="acm-modal" onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className="acm-head">
          <h3><GraduationCap size={17} />Koreksi Balasan AI</h3>
          <button type="button" className="acm-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {done ? (
          <div className="acm-done">
            <CheckCircle2 size={34} />
            <b>Koreksi disimpan</b>
            <p>AI akan memakai pelajaran ini di chat berikutnya. Kelola semua koreksi di Manajemen Agent → AI Sales → Koreksi.</p>
            <button type="button" className="acm-btn primary" onClick={onClose}>Selesai</button>
          </div>
        ) : (
          <div className="acm-body">
            <div className="acm-field">
              <span>Balasan AI</span>
              <div className="acm-orig">{msg.body}</div>
            </div>
            <label className="acm-field">
              <span>Seharusnya dibalas</span>
              <textarea rows={4} value={better} onChange={e => setBetter(e.target.value)} autoFocus />
            </label>
            <label className="acm-field">
              <span>Alasan / aturan <small>(opsional, membantu AI memahami)</small></span>
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="mis. Jangan langsung kasih harga sebelum tahu tagihan listriknya" />
            </label>
            {error && <div className="acm-error">{error}</div>}
            <div className="acm-actions">
              <button type="button" className="acm-btn" onClick={onClose}>Batal</button>
              <button type="submit" className="acm-btn primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Koreksi'}</button>
            </div>
          </div>
        )}
      </form>
      <style>{`
        .acm-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .acm-modal { width: 100%; max-width: 460px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 50px var(--shadow); color: var(--text); }
        .acm-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 4px 18px; }
        .acm-head h3 { display: flex; align-items: center; gap: 8px; font-size: 15.5px; font-weight: 700; }
        .acm-head h3 svg { color: #8b5cf6; }
        .acm-close { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .acm-close:hover { background: var(--surface3); }
        .acm-body { display: flex; flex-direction: column; gap: 12px; padding: 10px 18px 18px; }
        .acm-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text2); }
        .acm-field small { font-weight: 400; color: var(--muted); }
        .acm-orig { padding: 9px 12px; border-radius: 10px; background: rgba(229,62,62,0.07); border: 1px solid rgba(229,62,62,0.25); color: var(--text2); font-weight: 400; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
        .acm-field textarea, .acm-field input { width: 100%; padding: 9px 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-size: 13.5px; font-weight: 400; font-family: inherit; line-height: 1.45; outline: none; resize: vertical; }
        .acm-field input { height: 40px; }
        .acm-field textarea:focus, .acm-field input:focus { border-color: var(--primary); }
        .acm-error { padding: 8px 12px; border-radius: 9px; background: rgba(229,62,62,0.1); color: var(--danger); font-size: 13px; }
        .acm-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .acm-btn { height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .acm-btn.primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }
        .acm-btn:disabled { opacity: 0.6; }
        .acm-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 12px 22px 22px; }
        .acm-done svg { color: var(--success); }
        .acm-done p { font-size: 13px; color: var(--text2); line-height: 1.5; }
      `}</style>
    </div>
  )
}

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { changeMyPassword } from '../hooks/useApi'

const MIN_LEN = 8

function PwdField({ label, value, onChange, autoComplete, autoFocus, hint, invalid }) {
  const [show, setShow] = useState(false)
  return (
    <label className="cp-field">
      <span className="cp-label">{label}</span>
      <span className="cp-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={72}
        />
        <button type="button" className="cp-eye" onClick={() => setShow(v => !v)}
          aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} tabIndex={-1}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {hint && <span className={`cp-hint${invalid ? ' bad' : ''}`}>{hint}</span>}
    </label>
  )
}

// Modal ganti kata sandi akun sendiri. Setelah berhasil, token perangkat ini
// diganti token baru; sesi di perangkat lain otomatis berakhir.
export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const mismatch = confirm.length > 0 && confirm !== next
  const tooShort = next.length > 0 && next.length < MIN_LEN
  const canSubmit = current && next.length >= MIN_LEN && confirm === next && !saving

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const res = await changeMyPassword(current, next)
      if (res?.token) localStorage.setItem('wa_token', res.token)
      setDone(true)
    } catch (err) {
      setError(err?.response?.data?.error || 'Gagal mengubah kata sandi. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={e => e.stopPropagation()}>
        <div className="cp-head">
          <h3 id="cp-title"><KeyRound size={17} />Ubah Kata Sandi</h3>
          <button className="cp-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        {done ? (
          <div className="cp-done">
            <CheckCircle2 size={36} />
            <b>Kata sandi berhasil diubah</b>
            <p>Gunakan kata sandi baru saat login berikutnya. Perangkat lain yang memakai akun ini akan diminta login ulang.</p>
            <button className="cp-btn primary" onClick={onClose}>Selesai</button>
          </div>
        ) : (
          <form onSubmit={submit} className="cp-body">
            <PwdField label="Kata sandi lama" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
            <PwdField label="Kata sandi baru" value={next} onChange={setNext} autoComplete="new-password"
              hint={`Minimal ${MIN_LEN} karakter`} invalid={tooShort} />
            <PwdField label="Ulangi kata sandi baru" value={confirm} onChange={setConfirm} autoComplete="new-password"
              hint={mismatch ? 'Kata sandi tidak sama' : null} invalid={mismatch} />
            {error && <div className="cp-error"><AlertCircle size={15} />{error}</div>}
            <div className="cp-actions">
              <button type="button" className="cp-btn" onClick={onClose}>Batal</button>
              <button type="submit" className="cp-btn primary" disabled={!canSubmit}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .cp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
        .cp-modal { width: 100%; max-width: 400px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 50px var(--shadow); color: var(--text); }
        .cp-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 6px; }
        .cp-head h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
        .cp-head h3 svg { color: var(--primary); }
        .cp-close { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .cp-close:hover { background: var(--surface3); color: var(--text2); }
        .cp-body { display: flex; flex-direction: column; gap: 14px; padding: 10px 18px 18px; }
        .cp-field { display: flex; flex-direction: column; gap: 6px; }
        .cp-label { font-size: 12.5px; font-weight: 600; color: var(--text2); }
        .cp-input-wrap { position: relative; display: flex; }
        .cp-input-wrap input { width: 100%; height: 40px; padding: 0 40px 0 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-size: 14px; outline: none; font-family: inherit; }
        .cp-input-wrap input:focus { border-color: var(--primary); }
        .cp-eye { position: absolute; right: 4px; top: 4px; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .cp-eye:hover { color: var(--text2); background: var(--surface3); }
        .cp-hint { font-size: 11.5px; color: var(--muted); }
        .cp-hint.bad { color: var(--danger, #e53e3e); }
        .cp-error { display: flex; align-items: center; gap: 7px; padding: 9px 12px; border-radius: 10px; background: rgba(229,62,62,0.1); border: 1px solid rgba(229,62,62,0.3); color: var(--danger, #e53e3e); font-size: 13px; }
        .cp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .cp-btn { height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .cp-btn:hover:not(:disabled) { background: var(--surface3); }
        .cp-btn.primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }
        .cp-btn.primary:hover:not(:disabled) { background: var(--primary-hover); }
        .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cp-done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 14px 22px 22px; }
        .cp-done svg { color: var(--success); }
        .cp-done b { font-size: 15px; }
        .cp-done p { font-size: 13px; color: var(--text2); line-height: 1.5; }
        .cp-done .cp-btn { margin-top: 6px; min-width: 120px; }
      `}</style>
    </div>
  )
}

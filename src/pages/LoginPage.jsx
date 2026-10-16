import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, AlertCircle, User, Lock } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username || !password) { setError('Username dan password wajib diisi'); return }
    setLoading(true)
    try {
      await login(username, password)
      navigate('/inbox')
    } catch (err) {
      setError(err.response?.data?.error || 'Login gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lp-root">
      <div className="lp-card">
        <div className="lp-brand">
          <div className="lp-brand-icon">R</div>
          <div>
            <div className="lp-brand-name">Renus<span>Pro</span>-Chat</div>
            <div className="lp-brand-sub">PT. RENUS GLOBAL INDONESIA</div>
          </div>
        </div>

        <div className="lp-title">Selamat Datang</div>
        <div className="lp-desc">Masuk untuk mengakses chat WhatsApp</div>

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-field">
            <label htmlFor="lp-username">Username</label>
            <div className="lp-input-wrap">
            <User size={16} className="lp-input-ico" />
            <input
              id="lp-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
            />
            </div>
          </div>
          <div className="lp-field">
            <label htmlFor="lp-password">Password</label>
            <div className="lp-input-wrap lp-pw-wrap">
              <Lock size={16} className="lp-input-ico" />
              <input
                id="lp-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
              />
              <button type="button" className="lp-pw-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="lp-error" role="alert"><AlertCircle size={15} />{error}</div>}

          <button type="submit" className="lp-submit" disabled={loading}>
            {loading ? <><span className="lp-spin" /> Memproses…</> : 'Masuk'}
          </button>
        </form>

        <div className="lp-footer">Lupa password? Hubungi administrator sistem.</div>
      </div>

      <style>{`
        .lp-root {
          min-height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg);
          padding: 20px;
        }
        .lp-card {
          width: 100%; max-width: 400px;
          background: var(--surface);
          border-radius: 20px;
          padding: 40px 36px;
          box-shadow: 0 2px 4px var(--shadow), 0 12px 36px var(--shadow);
          border: 1px solid var(--border);
        }
        .lp-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
        .lp-brand-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: var(--primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: white; flex-shrink: 0;
        }
        .lp-brand-name { font-size: 17px; font-weight: 700; color: var(--text); line-height: 1; }
        .lp-brand-name span { color: var(--primary); }
        .lp-brand-sub { font-size: 10px; color: var(--muted); margin-top: 4px; letter-spacing: 0.4px; }
        .lp-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .lp-desc { font-size: 13px; color: var(--muted); margin-bottom: 28px; }
        .lp-form { display: flex; flex-direction: column; gap: 18px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label { font-size: 12.5px; font-weight: 600; color: var(--text2); }
        .lp-input-wrap { position: relative; }
        .lp-input-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
        .lp-field input {
          height: 46px;
          background: var(--surface2); border: 1.5px solid var(--border);
          border-radius: 11px; color: var(--text);
          padding: 0 14px 0 40px; font-size: 14px; outline: none; font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
        }
        .lp-field input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(53,99,233,0.10);
          background: var(--surface);
        }
        .lp-field input::placeholder { color: var(--muted); }
        .lp-pw-wrap { position: relative; }
        .lp-pw-wrap input { padding-right: 42px; }
        .lp-pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: var(--muted); padding: 4px;
        }
        .lp-pw-eye:hover { color: var(--primary); }
        .lp-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.25);
          border-radius: 10px; color: var(--danger); font-size: 13px;
        }
        .lp-error svg { flex-shrink: 0; }
        .lp-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: lpSpin 0.7s linear infinite; }
        @keyframes lpSpin { to { transform: rotate(360deg); } }
        .lp-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--primary); color: var(--on-primary);
          border-radius: 11px; height: 48px;
          font-size: 15px; font-weight: 600;
          transition: background 0.15s, box-shadow 0.15s; margin-top: 4px;
          box-shadow: 0 4px 14px rgba(53,99,233,0.30);
        }
        .lp-submit:hover { background: var(--primary-hover); }
        .lp-submit:disabled { opacity: 0.7; cursor: not-allowed; box-shadow: none; }
        @media (max-width: 480px) { .lp-card { padding: 32px 22px; border-radius: 18px; } }
        .lp-footer { text-align: center; font-size: 12px; color: var(--muted); margin-top: 24px; }
      `}</style>
    </div>
  )
}

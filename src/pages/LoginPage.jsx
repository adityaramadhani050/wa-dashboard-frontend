import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email dan password wajib diisi'); return }
    setLoading(true)
    try {
      await login(email, password)
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
        {/* Brand */}
        <div className="lp-brand">
          <div className="lp-brand-icon">R</div>
          <div>
            <div className="lp-brand-name">Renus<span>Pro</span></div>
            <div className="lp-brand-sub">PT. RENUS GLOBAL INDONESIA</div>
          </div>
        </div>

        <div className="lp-title">Selamat Datang</div>
        <div className="lp-desc">Masuk untuk mengakses dashboard</div>

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-field">
            <label>USERNAME</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Masukkan username"
              autoFocus
            />
          </div>
          <div className="lp-field">
            <label>PASSWORD</label>
            <div className="lp-pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password"
              />
              <button type="button" className="lp-pw-eye" onClick={() => setShowPw(s => !s)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="lp-error">{error}</div>}

          <button type="submit" className="lp-submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="lp-footer">Lupa password? Hubungi administrator sistem.</div>
      </div>

      <style>{`
        .lp-root {
          min-height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: #0f172a;
          padding: 20px;
        }
        .lp-card {
          width: 100%; max-width: 400px;
          background: #1e293b;
          border-radius: 16px;
          padding: 36px 32px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        /* Brand */
        .lp-brand {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 28px;
        }
        .lp-brand-icon {
          width: 44px; height: 44px; border-radius: 10px;
          background: #2563eb;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: white;
          flex-shrink: 0;
        }
        .lp-brand-name { font-size: 18px; font-weight: 700; color: #f1f5f9; line-height: 1; }
        .lp-brand-name span { color: #60a5fa; }
        .lp-brand-sub { font-size: 10px; color: #64748b; margin-top: 3px; letter-spacing: 0.5px; }
        .lp-title { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
        .lp-desc { font-size: 13px; color: #64748b; margin-bottom: 24px; }
        /* Form */
        .lp-form { display: flex; flex-direction: column; gap: 16px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label {
          font-size: 11px; font-weight: 700; color: #94a3b8;
          letter-spacing: 0.6px;
        }
        .lp-field input {
          background: #0f172a; border: 1.5px solid #334155;
          border-radius: 8px; color: #f1f5f9;
          padding: 12px 14px; font-size: 14px; outline: none;
          transition: border-color 0.15s; width: 100%;
        }
        .lp-field input:focus { border-color: #2563eb; }
        .lp-field input::placeholder { color: #475569; }
        .lp-pw-wrap { position: relative; }
        .lp-pw-wrap input { padding-right: 42px; }
        .lp-pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: #64748b; padding: 4px;
        }
        .lp-pw-eye:hover { color: #94a3b8; }
        .lp-error {
          padding: 10px 14px;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px; color: #fca5a5; font-size: 13px;
        }
        .lp-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #2563eb; color: white;
          border-radius: 8px; padding: 13px;
          font-size: 15px; font-weight: 600;
          transition: background 0.15s; margin-top: 4px;
        }
        .lp-submit:hover { background: #1d4ed8; }
        .lp-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .lp-footer { text-align: center; font-size: 12px; color: #475569; margin-top: 20px; }
      `}</style>
    </div>
  )
}

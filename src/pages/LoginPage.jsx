import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

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
        {/* Brand */}
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
            <label>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
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
                autoComplete="current-password"
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
          background: #f2f5f9;
          padding: 20px;
          position: relative;
        }
        .lp-root::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(74,130,196,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(74,130,196,0.05) 0%, transparent 50%);
          pointer-events: none;
        }
        .lp-card {
          width: 100%; max-width: 400px;
          background: #ffffff;
          border-radius: 18px;
          padding: 40px 36px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 16px 40px rgba(74,130,196,0.10);
          border: 1px solid #e0e8f2;
          position: relative;
        }
        .lp-brand {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 32px;
        }
        .lp-brand-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: #4a82c4;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: white;
          flex-shrink: 0; letter-spacing: -0.5px;
        }
        .lp-brand-name { font-size: 17px; font-weight: 700; color: #1d2d42; line-height: 1; }
        .lp-brand-name span { color: #4a82c4; }
        .lp-brand-sub { font-size: 10px; color: #8fa2b8; margin-top: 4px; letter-spacing: 0.4px; }
        .lp-title { font-size: 21px; font-weight: 700; color: #1d2d42; margin-bottom: 4px; }
        .lp-desc { font-size: 13px; color: #8fa2b8; margin-bottom: 28px; }
        .lp-form { display: flex; flex-direction: column; gap: 18px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label {
          font-size: 11px; font-weight: 700; color: #8fa2b8;
          letter-spacing: 0.7px;
        }
        .lp-field input {
          background: #f7f9fc; border: 1.5px solid #e0e8f2;
          border-radius: 10px; color: #1d2d42;
          padding: 12px 14px; font-size: 14px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
        }
        .lp-field input:focus {
          border-color: #4a82c4;
          box-shadow: 0 0 0 3px rgba(74,130,196,0.1);
          background: #fff;
        }
        .lp-field input::placeholder { color: #b8c8d8; }
        .lp-pw-wrap { position: relative; }
        .lp-pw-wrap input { padding-right: 42px; }
        .lp-pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: #a0b3c8; padding: 4px;
        }
        .lp-pw-eye:hover { color: #4a82c4; }
        .lp-error {
          padding: 10px 14px;
          background: rgba(224,82,82,0.06); border: 1px solid rgba(224,82,82,0.18);
          border-radius: 8px; color: #c44; font-size: 13px;
        }
        .lp-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #4a82c4; color: white;
          border-radius: 10px; padding: 13px;
          font-size: 15px; font-weight: 600;
          transition: background 0.15s, box-shadow 0.15s; margin-top: 4px;
          box-shadow: 0 2px 8px rgba(74,130,196,0.25);
        }
        .lp-submit:hover { background: #3a6da8; box-shadow: 0 4px 12px rgba(74,130,196,0.3); }
        .lp-submit:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
        .lp-footer { text-align: center; font-size: 12px; color: #a0b3c8; margin-top: 24px; }
      `}</style>
    </div>
  )
}

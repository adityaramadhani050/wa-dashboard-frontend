import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

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
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="lp-footer">Lupa password? Hubungi administrator sistem.</div>
      </div>

      <style>{`
        .lp-root {
          min-height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: #f0f3fa;
          padding: 20px;
        }
        .lp-card {
          width: 100%; max-width: 400px;
          background: #fff;
          border-radius: 20px;
          padding: 40px 36px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 12px 36px rgba(53,99,233,0.10);
          border: 1px solid #e4eaf5;
        }
        .lp-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
        .lp-brand-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: #3563e9;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: white; flex-shrink: 0;
        }
        .lp-brand-name { font-size: 17px; font-weight: 700; color: #1a2540; line-height: 1; }
        .lp-brand-name span { color: #3563e9; }
        .lp-brand-sub { font-size: 10px; color: #8a9bb8; margin-top: 4px; letter-spacing: 0.4px; }
        .lp-title { font-size: 22px; font-weight: 700; color: #1a2540; margin-bottom: 4px; }
        .lp-desc { font-size: 13px; color: #8a9bb8; margin-bottom: 28px; }
        .lp-form { display: flex; flex-direction: column; gap: 18px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label { font-size: 11px; font-weight: 700; color: #8a9bb8; letter-spacing: 0.7px; }
        .lp-field input {
          background: #f7f9fd; border: 1.5px solid #e4eaf5;
          border-radius: 10px; color: #1a2540;
          padding: 12px 14px; font-size: 14px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
        }
        .lp-field input:focus {
          border-color: #3563e9;
          box-shadow: 0 0 0 3px rgba(53,99,233,0.10);
          background: #fff;
        }
        .lp-field input::placeholder { color: #b8c8d8; }
        .lp-pw-wrap { position: relative; }
        .lp-pw-wrap input { padding-right: 42px; }
        .lp-pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: #a8b8d0; padding: 4px;
        }
        .lp-pw-eye:hover { color: #3563e9; }
        .lp-error {
          padding: 10px 14px;
          background: rgba(229,62,62,0.06); border: 1px solid rgba(229,62,62,0.18);
          border-radius: 8px; color: #c44; font-size: 13px;
        }
        .lp-submit {
          display: flex; align-items: center; justify-content: center;
          background: #3563e9; color: white;
          border-radius: 10px; padding: 13px;
          font-size: 15px; font-weight: 600;
          transition: background 0.15s, box-shadow 0.15s; margin-top: 4px;
          box-shadow: 0 4px 14px rgba(53,99,233,0.30);
        }
        .lp-submit:hover { background: #2850cc; }
        .lp-submit:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
        .lp-footer { text-align: center; font-size: 12px; color: #a8b8d0; margin-top: 24px; }
      `}</style>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        <div className="lp-logo">
          <div className="lp-logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="30" height="30">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h1>WA Dashboard</h1>
          <p>Multi-agent WhatsApp management</p>
        </div>

        <form onSubmit={handleSubmit} className="lp-form">
          <div className="lp-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="agent@company.com"
              autoFocus
            />
          </div>
          <div className="lp-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="lp-error">{error}</div>}
          <button type="submit" className="lp-submit" disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>

      <style>{`
        .lp-root {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111b21;
          padding: 20px;
        }
        .lp-card {
          width: 100%;
          max-width: 380px;
          background: #202c33;
          border-radius: 12px;
          padding: 40px 36px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }
        .lp-logo { text-align: center; margin-bottom: 32px; }
        .lp-logo-icon {
          width: 68px; height: 68px;
          background: #00a884;
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 24px rgba(0,168,132,0.35);
        }
        .lp-logo h1 { font-size: 22px; font-weight: 600; color: #e9edef; margin-bottom: 4px; }
        .lp-logo p { font-size: 13px; color: #8696a0; }
        .lp-form { display: flex; flex-direction: column; gap: 16px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label { font-size: 13px; color: #8696a0; font-weight: 500; }
        .lp-field input {
          background: #2a3942; border: none; border-radius: 8px;
          color: #e9edef; padding: 12px 16px; font-size: 15px;
          outline: none; transition: box-shadow 0.15s;
        }
        .lp-field input:focus { box-shadow: 0 0 0 2px rgba(0,168,132,0.4); }
        .lp-field input::placeholder { color: #667781; }
        .lp-error {
          padding: 10px 14px;
          background: rgba(241,92,109,0.12);
          border: 1px solid rgba(241,92,109,0.2);
          border-radius: 8px; color: #f15c6d; font-size: 13px;
        }
        .lp-submit {
          background: #00a884; color: white;
          border-radius: 8px; padding: 13px;
          font-size: 15px; font-weight: 600;
          transition: background 0.15s; margin-top: 4px;
        }
        .lp-submit:hover { background: #008069; }
        .lp-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MessageSquare, Lock, Mail, AlertCircle } from 'lucide-react'

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
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      await login(email)
      navigate('/inbox')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h1>WA Dashboard</h1>
          <p>Multi-agent WhatsApp management</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email address</label>
            <div className="input-icon">
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@company.com"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-icon">
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="error-msg">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          padding: 20px;
          background-image: radial-gradient(ellipse at 20% 50%, rgba(37,211,102,0.05) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 20%, rgba(61,142,248,0.05) 0%, transparent 60%);
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px;
          box-shadow: var(--shadow);
        }
        .login-logo {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo-icon {
          width: 64px;
          height: 64px;
          background: var(--green);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 24px rgba(37,211,102,0.3);
        }
        .login-logo h1 { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .login-logo p { font-size: 13px; color: var(--text-muted); }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
        .input-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon svg {
          position: absolute;
          left: 12px;
          color: var(--text-dim);
          pointer-events: none;
        }
        .input-icon input { padding-left: 36px; }
        .error-msg {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: rgba(255,71,87,0.1);
          border: 1px solid rgba(255,71,87,0.2);
          border-radius: var(--radius-sm);
          color: var(--red);
          font-size: 13px;
        }
        .login-submit { width: 100%; justify-content: center; padding: 12px; font-size: 14px; margin-top: 4px; }
      `}</style>
    </div>
  )
}

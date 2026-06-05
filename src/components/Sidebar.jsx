import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { MessageSquare, BarChart2, QrCode, LogOut } from 'lucide-react'

export default function IconBar() {
  const { user, logout } = useAuth()
  const { waConnected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  const handleLogout = () => { logout(); navigate('/login') }

  const navItems = [
    { path: '/inbox', icon: MessageSquare, label: 'Chats', adminOnly: false },
    { path: '/analytics', icon: BarChart2, label: 'Analytics', adminOnly: true },
    { path: '/qr', icon: QrCode, label: 'QR Setup', adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="icon-bar">
      <div className="ib-top">
        <div className="ib-user-avatar" title={user?.email}>
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>

      <div className="ib-nav">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === '/inbox' && location.pathname.startsWith('/chat/'))
          return (
            <button
              key={path}
              className={`ib-btn${isActive ? ' active' : ''}`}
              onClick={() => navigate(path)}
              title={label}
            >
              <Icon size={22} />
            </button>
          )
        })}
      </div>

      <div className="ib-bottom">
        <div className={`ib-dot ${waConnected ? 'online' : 'offline'}`} title={waConnected ? 'WA Connected' : 'WA Disconnected'} />
        <button className="ib-btn logout" onClick={handleLogout} title="Logout">
          <LogOut size={20} />
        </button>
      </div>

      <style>{`
        .icon-bar {
          width: 72px;
          min-width: 72px;
          background: #202c33;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 14px 0;
          border-right: 1px solid #222d34;
          flex-shrink: 0;
        }
        .ib-top, .ib-nav, .ib-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .ib-user-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: #6b7c85;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600; color: white;
          cursor: default; margin-bottom: 4px;
        }
        .ib-btn {
          width: 48px; height: 48px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #8696a0; transition: all 0.15s;
        }
        .ib-btn:hover { background: #2a3942; color: #e9edef; }
        .ib-btn.active { color: #00a884; }
        .ib-btn.logout:hover { color: #f15c6d; background: rgba(241,92,109,0.1); }
        .ib-dot {
          width: 8px; height: 8px; border-radius: 50%; margin-bottom: 4px;
        }
        .ib-dot.online { background: #00a884; box-shadow: 0 0 8px rgba(0,168,132,0.6); }
        .ib-dot.offline { background: #667781; }
      `}</style>
    </div>
  )
}

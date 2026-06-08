import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { MessageSquare, BarChart2, QrCode, LogOut, Users } from 'lucide-react'

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
    { path: '/agents', icon: Users, label: 'Manajemen Agent', adminOnly: true },
    { path: '/qr', icon: QrCode, label: 'QR Setup', adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="icon-bar">
      <div className="ib-top">
        {/* ib-logo class hides this on mobile */}
        <div className="ib-logo" style={{
          width: 34, height: 34, borderRadius: 10,
          background: '#3563e9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color: '#fff',
          marginBottom: 16, flexShrink: 0,
        }}>R</div>

        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path === '/inbox' && location.pathname.startsWith('/chat/'))
          return (
            <button key={path} className={`ib-btn${isActive ? ' active' : ''}`} onClick={() => navigate(path)} title={label}>
              <Icon size={19} />
            </button>
          )
        })}
      </div>

      <div className="ib-bottom">
        <div
          className={`ib-dot ${waConnected ? 'online' : 'offline'}`}
          title={waConnected ? 'WA Connected' : 'WA Disconnected'}
        />
        <div className="ib-user-chip">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <button className="ib-btn logout" onClick={handleLogout} title="Logout">
          <LogOut size={17} />
        </button>
      </div>
    </div>
  )
}

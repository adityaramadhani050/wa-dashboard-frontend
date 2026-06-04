import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { MessageSquare, BarChart2, QrCode, LogOut, Wifi, WifiOff } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/qr', icon: QrCode, label: 'QR Setup' },
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { waConnected } = useSocket()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <span className="sidebar-title">WA Dashboard</span>
        </div>
        <div className={clsx('wa-status', waConnected ? 'connected' : 'disconnected')}>
          {waConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{waConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx('nav-item', isActive && 'active')}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="user-details">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-w);
          min-width: var(--sidebar-w);
          background: var(--bg-card);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
          transition: width 0.2s ease;
        }
        .sidebar-header {
          padding: 20px 16px 16px;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .logo-icon {
          width: 36px;
          height: 36px;
          background: var(--green);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .sidebar-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
        }
        .wa-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
        .wa-status.connected {
          background: rgba(37,211,102,0.12);
          color: var(--green);
        }
        .wa-status.disconnected {
          background: rgba(255,71,87,0.12);
          color: var(--red);
        }
        .sidebar-nav {
          flex: 1;
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s ease;
          white-space: nowrap;
          overflow: hidden;
        }
        .nav-item:hover {
          background: var(--bg-hover);
          color: var(--text);
        }
        .nav-item.active {
          background: rgba(37,211,102,0.12);
          color: var(--green);
        }
        .sidebar-footer {
          padding: 12px 8px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          background: var(--green-dark);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .user-details { overflow: hidden; }
        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-email {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .logout-btn {
          padding: 6px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .logout-btn:hover {
          background: rgba(255,71,87,0.1);
          color: var(--red);
        }
        @media (max-width: 768px) {
          .sidebar-title, .user-details, .nav-item span { display: none; }
          .sidebar-logo { justify-content: center; margin-bottom: 8px; }
          .user-info { justify-content: center; }
          .sidebar-footer { justify-content: center; flex-direction: column; }
          .wa-status span { display: none; }
        }
      `}</style>
    </aside>
  )
}

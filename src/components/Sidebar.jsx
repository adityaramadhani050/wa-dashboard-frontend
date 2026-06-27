import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getDueReminders, markReminderDone } from '../hooks/useApi'
import { enableWebPush, getNotificationStatus } from '../native/webpush'
import { MessageSquare, BarChart2, QrCode, LogOut, Users, BookUser, Zap, Bell, BellRing } from 'lucide-react'

function formatReminderTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('id', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function IconBar() {
  const { user, logout } = useAuth()
  const { waConnected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'
  const [dueReminders, setDueReminders] = useState([])
  const [showReminders, setShowReminders] = useState(false)
  const [completing, setCompleting] = useState(null)
  const panelRef = useRef(null)
  const [notifStatus, setNotifStatus] = useState('granted') // sembunyikan tombol default
  const [enabling, setEnabling] = useState(false)

  useEffect(() => { setNotifStatus(getNotificationStatus()) }, [])

  const handleEnableNotif = async () => {
    if (enabling) return
    setEnabling(true)
    try {
      const res = await enableWebPush()
      if (res.ok) {
        setNotifStatus('granted')
        alert('Notifikasi berhasil diaktifkan! Anda akan menerima pesan baru walau aplikasi tertutup.')
      } else if (res.reason === 'denied') {
        alert('Notifikasi diblokir. Aktifkan lewat: Setelan HP → Aplikasi → RenusPro Chat → Notifikasi → Izinkan.')
      } else if (res.reason === 'no-vapid') {
        alert('Server notifikasi belum dikonfigurasi (VAPID). Hubungi admin.')
      } else if (res.reason === 'unsupported') {
        alert('Browser ini tidak mendukung notifikasi. Coba install aplikasi (Add to Home Screen) di Chrome.')
      } else {
        alert('Gagal mengaktifkan notifikasi, coba lagi.')
      }
    } finally { setEnabling(false) }
  }

  const loadDueReminders = useCallback(async () => {
    try { setDueReminders(await getDueReminders()) } catch {}
  }, [])

  useEffect(() => {
    loadDueReminders()
    const interval = setInterval(loadDueReminders, 60000)
    return () => clearInterval(interval)
  }, [loadDueReminders])

  useEffect(() => {
    if (!showReminders) return
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowReminders(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showReminders])

  const handleMarkDone = async (id) => {
    setCompleting(id)
    try { await markReminderDone(id); await loadDueReminders() } catch {}
    finally { setCompleting(null) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const navItems = [
    { path: '/inbox',    icon: MessageSquare, label: 'Chats',           adminOnly: false },
    { path: '/contacts', icon: BookUser,      label: 'Kontak',          adminOnly: false },
    { path: '/analytics',icon: BarChart2,     label: 'Analytics',       adminOnly: true  },
    { path: '/agents',   icon: Users,         label: 'Manajemen Agent', adminOnly: true  },
    { path: '/templates',icon: Zap,           label: 'Template & Galeri', adminOnly: true },
    { path: '/qr',       icon: QrCode,        label: 'QR Setup',        adminOnly: true  },
  ].filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="icon-bar">
      <div className="ib-top">
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
        {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
          <button className="ib-btn ib-notif-enable" onClick={handleEnableNotif} disabled={enabling} title="Aktifkan notifikasi pesan baru">
            <BellRing size={18} />
            <span className="ib-notif-dot" />
          </button>
        )}
        <div className="ib-reminder-wrap" ref={panelRef}>
          <button className="ib-btn ib-bell-btn" onClick={() => setShowReminders(s => !s)} title="Pengingat Follow-up">
            <Bell size={18} />
            {dueReminders.length > 0 && <span className="ib-badge">{dueReminders.length > 9 ? '9+' : dueReminders.length}</span>}
          </button>
          {showReminders && (
            <div className="ib-reminder-panel">
              <div className="ib-reminder-panel-title">Pengingat Follow-up</div>
              {dueReminders.length === 0 ? (
                <div className="ib-reminder-empty">Tidak ada pengingat jatuh tempo.</div>
              ) : (
                <div className="ib-reminder-list">
                  {dueReminders.map(r => (
                    <div key={r.id} className="ib-reminder-item">
                      <div className="ib-reminder-info">
                        <span className="ib-reminder-name">{r.conversations?.contact?.name || r.conversations?.contact?.manual_wa_number || r.conversations?.contact?.phone || 'Unknown'}</span>
                        {r.note && <span className="ib-reminder-note">{r.note}</span>}
                        <span className="ib-reminder-time">{formatReminderTime(r.remind_at)}</span>
                      </div>
                      <button className="ib-reminder-done" disabled={completing === r.id} onClick={() => handleMarkDone(r.id)}>
                        {completing === r.id ? '...' : 'Selesai'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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

      <style>{`
        .ib-reminder-wrap { position: relative; }
        .ib-bell-btn { position: relative; }
        .ib-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; border-radius: 999px; background: var(--danger, #e53e3e); color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 3px; line-height: 1; }
        .ib-notif-enable { position: relative; color: var(--warning, #d08b28); }
        .ib-notif-enable:hover { background: rgba(208,139,40,0.12); color: var(--warning, #d08b28); }
        .ib-notif-enable:disabled { opacity: 0.6; cursor: not-allowed; }
        .ib-notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--warning, #d08b28); animation: pulse 1.6s ease infinite; }
        .ib-reminder-panel { position: absolute; bottom: calc(100% + 8px); left: 0; width: 280px; max-height: 360px; overflow-y: auto; background: #fff; border: 1px solid #e4eaf5; border-radius: 12px; box-shadow: 0 8px 24px rgba(26,37,64,0.15); z-index: 300; }
        .ib-reminder-panel-title { padding: 12px 14px 8px; font-size: 12px; font-weight: 700; color: #1a2540; border-bottom: 1px solid #f0f3fa; }
        .ib-reminder-empty { padding: 16px 14px; font-size: 12px; color: #a8b8d0; }
        .ib-reminder-list { display: flex; flex-direction: column; }
        .ib-reminder-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #f4f6fb; }
        .ib-reminder-item:last-child { border-bottom: none; }
        .ib-reminder-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ib-reminder-name { font-size: 13px; font-weight: 600; color: #1a2540; }
        .ib-reminder-note { font-size: 11px; color: #4f607a; }
        .ib-reminder-time { font-size: 10px; color: #a8b8d0; }
        .ib-reminder-done { flex-shrink: 0; padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 600; background: #f0f3fa; color: #27a87a; transition: all 0.15s; }
        .ib-reminder-done:hover { background: rgba(39,168,122,0.12); }
        .ib-reminder-done:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 768px) {
          .ib-reminder-panel { bottom: calc(100% + 8px); top: auto; left: auto; right: 0; }
        }
      `}</style>
    </div>
  )
}

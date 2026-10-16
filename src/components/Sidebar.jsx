import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getFollowupDue } from '../hooks/useApi'
import { STEP_INFO, dueLabel, dueTone } from './followupUi'
import { enableWebPush, getNotificationStatus } from '../native/webpush'
import { MessageSquare, BarChart2, QrCode, LogOut, Users, BookUser, Zap, Bell, BellRing, Megaphone, ListChecks } from 'lucide-react'

export default function IconBar() {
  const { user, logout } = useAuth()
  const { waConnected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'
  // Lonceng = tugas follow-up jatuh tempo (hari ini & terlambat) milik user
  const [dueTasks, setDueTasks] = useState([])
  const [dueCount, setDueCount] = useState(0)
  const [showReminders, setShowReminders] = useState(false)
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

  const loadDue = useCallback(async () => {
    try {
      const d = await getFollowupDue()
      setDueTasks(Array.isArray(d?.tasks) ? d.tasks : [])
      setDueCount(d?.count || 0)
    } catch {}
  }, [])

  useEffect(() => {
    loadDue()
    const interval = setInterval(loadDue, 60000)
    // Segarkan saat follow-up diselesaikan dari halaman lain
    window.addEventListener('fu:changed', loadDue)
    return () => { clearInterval(interval); window.removeEventListener('fu:changed', loadDue) }
  }, [loadDue])

  useEffect(() => {
    if (!showReminders) return
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowReminders(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showReminders])

  const openTask = (t) => {
    setShowReminders(false)
    navigate(`/chat/${t.conversation.id}`)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const navItems = [
    { path: '/inbox',    icon: MessageSquare, label: 'Chats',           adminOnly: false },
    { path: '/followup', icon: ListChecks,    label: 'Follow-up',       adminOnly: false },
    { path: '/analytics',icon: BarChart2,     label: 'Analytics',       adminOnly: true  },
    { path: '/agents',   icon: Users,         label: 'Manajemen Agent', adminOnly: true  },
    { path: '/contacts', icon: BookUser,      label: 'Kontak',          adminOnly: false },
    { path: '/templates',icon: Zap,           label: 'Template & Galeri', adminOnly: true },
    { path: '/broadcast',icon: Megaphone,     label: 'Broadcast Promo', adminOnly: true  },
    { path: '/qr',       icon: QrCode,        label: 'QR Setup',        adminOnly: true  },
  ].filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="icon-bar">
      <div className="ib-top">
        <div className="ib-logo" style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color: 'var(--on-primary)',
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
          <button className="ib-btn ib-bell-btn" onClick={() => { setShowReminders(s => !s); if (!showReminders) loadDue() }} title="Follow-up jatuh tempo">
            <Bell size={18} />
            {dueCount > 0 && <span className="ib-badge">{dueCount > 9 ? '9+' : dueCount}</span>}
          </button>
          {showReminders && (
            <div className="ib-reminder-panel">
              <div className="ib-reminder-panel-title">Follow-up jatuh tempo{dueCount ? ` (${dueCount})` : ''}</div>
              {dueTasks.length === 0 ? (
                <div className="ib-reminder-empty">Tidak ada follow-up yang jatuh tempo. 👍</div>
              ) : (
                <div className="ib-reminder-list">
                  {dueTasks.map(t => {
                    const st = STEP_INFO[t.step] || { label: t.step_label }
                    return (
                      <button key={t.id} className="ib-reminder-item" onClick={() => openTask(t)}>
                        <div className="ib-reminder-info">
                          <span className="ib-reminder-name">{t.conversation.contact_name}</span>
                          <span className="ib-reminder-note">
                            <span className="ib-fu-step" style={{ background: st.color || 'var(--primary)' }}>{st.day ? `${st.day} · ` : ''}{st.label}</span>
                            {isAdmin && t.conversation.agent?.name ? ` ${t.conversation.agent.name}` : ''}
                          </span>
                          {t.step === 'manual' && t.note && <span className="ib-reminder-time">{t.note}</span>}
                        </div>
                        <span className={`ib-fu-due ${dueTone(t)}`}>{dueLabel(t)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <button className="ib-reminder-all" onClick={() => { setShowReminders(false); navigate('/followup') }}>Lihat semua follow-up →</button>
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
        .ib-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; border-radius: 999px; background: var(--danger, #e53e3e); color: var(--on-primary); font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 3px; line-height: 1; }
        .ib-notif-enable { position: relative; color: var(--warning, #d08b28); }
        .ib-notif-enable:hover { background: rgba(208,139,40,0.12); color: var(--warning, #d08b28); }
        .ib-notif-enable:disabled { opacity: 0.6; cursor: not-allowed; }
        .ib-notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--warning, #d08b28); animation: pulse 1.6s ease infinite; }
        .ib-reminder-panel { position: absolute; bottom: calc(100% + 8px); left: 0; width: 280px; max-height: 360px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px var(--shadow); z-index: 300; }
        .ib-reminder-panel-title { padding: 12px 14px 8px; font-size: 12px; font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border); }
        .ib-reminder-empty { padding: 16px 14px; font-size: 12px; color: var(--muted); }
        .ib-reminder-list { display: flex; flex-direction: column; }
        .ib-reminder-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
        .ib-reminder-item:last-child { border-bottom: none; }
        .ib-reminder-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ib-reminder-name { font-size: 13px; font-weight: 600; color: var(--text); }
        .ib-reminder-note { font-size: 11px; color: var(--text2); }
        .ib-reminder-time { font-size: 10px; color: var(--muted); }
        button.ib-reminder-item { width: 100%; text-align: left; cursor: pointer; }
        button.ib-reminder-item:hover { background: var(--surface3); }
        .ib-fu-step { display: inline-block; color: #fff; font-size: 9.5px; font-weight: 800; letter-spacing: .3px; padding: 1px 6px; border-radius: 999px; margin-top: 2px; }
        .ib-fu-due { flex-shrink: 0; font-size: 10.5px; font-weight: 700; }
        .ib-fu-due.today { color: #d97706; } .ib-fu-due.late { color: var(--danger, #e53e3e); }
        .ib-reminder-all { width: 100%; padding: 10px 14px; font-size: 12px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border); text-align: center; }
        .ib-reminder-all:hover { background: var(--surface3); }
        @media (max-width: 768px) {
          .ib-reminder-panel { bottom: calc(100% + 8px); top: auto; left: auto; right: 0; }
        }
      `}</style>
    </div>
  )
}

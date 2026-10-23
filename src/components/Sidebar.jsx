import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getFollowupDue, getNumberRequests, fulfillNumberRequest, rejectNumberRequest } from '../hooks/useApi'
import { STEP_INFO, dueLabel, dueTone } from './followupUi'
import ChangePasswordModal from './ChangePasswordModal'
import { enableWebPush, getNotificationStatus } from '../native/webpush'
import { MessageSquare, BarChart2, QrCode, LogOut, Users, BookUser, Zap, Bell, BellRing, Megaphone, ListChecks, LayoutGrid, X, CheckCircle2, KeyRound, Phone } from 'lucide-react'

// Permintaan nomor yang sudah dilihat agent (hasil disetujui/ditolak)
const NR_SEEN_KEY = 'nr_seen'
const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(NR_SEEN_KEY) || '[]')) } catch { return new Set() } }
const saveSeen = (set) => { try { localStorage.setItem(NR_SEEN_KEY, JSON.stringify([...set].slice(-200))) } catch {} }

// Admin: isi nomor / tolak permintaan nomor dari agent
function NumberRequestAdminItem({ r, onDone, onOpen }) {
  const [number, setNumber] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn) => {
    setBusy(true); setErr('')
    try { await fn(); onDone() } catch (e) { setErr(e?.response?.data?.error || 'Gagal memproses.') } finally { setBusy(false) }
  }
  return (
    <div className="ib-nr-item">
      <button className="ib-nr-head" onClick={onOpen} title="Buka chat">
        <span className="ib-reminder-name">{r.contact?.name || 'Customer'}</span>
        <span className="ib-reminder-agent">dari {r.agent?.name || 'agent'}</span>
      </button>
      {r.note && <div className="ib-nr-note">“{r.note}”</div>}
      {!rejecting ? (
        <div className="ib-nr-actions">
          <input value={number} onChange={e => setNumber(e.target.value)} placeholder="08xx / 628xx" inputMode="tel" disabled={busy}
            onKeyDown={e => { if (e.key === 'Enter' && number.trim()) run(() => fulfillNumberRequest(r.id, number)) }} />
          <button className="ib-nr-ok" disabled={busy || !number.trim()} onClick={() => run(() => fulfillNumberRequest(r.id, number))}>Simpan</button>
          <button className="ib-nr-no" disabled={busy} onClick={() => setRejecting(true)}>Tolak</button>
        </div>
      ) : (
        <div className="ib-nr-actions">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan ditolak" autoFocus disabled={busy}
            onKeyDown={e => { if (e.key === 'Enter' && reason.trim()) run(() => rejectNumberRequest(r.id, reason)) }} />
          <button className="ib-nr-no" disabled={busy || !reason.trim()} onClick={() => run(() => rejectNumberRequest(r.id, reason))}>Kirim</button>
          <button className="ib-nr-cancel" disabled={busy} onClick={() => setRejecting(false)}>Batal</button>
        </div>
      )}
      {err && <div className="ib-nr-err">{err}</div>}
    </div>
  )
}

// mobile: true -> tampil langsung di navbar bawah HP; sisanya masuk menu "Lainnya"
const NAV_ITEMS = [
  { path: '/inbox',     icon: MessageSquare, label: 'Chats',             adminOnly: false, mobile: true },
  { path: '/followup',  icon: ListChecks,    label: 'Follow-up',         adminOnly: true,  mobile: true },
  { path: '/analytics', icon: BarChart2,     label: 'Analytics',         adminOnly: true,  mobile: true },
  { path: '/agents',    icon: Users,         label: 'Manajemen Agent',   short: 'Agent',     adminOnly: true },
  { path: '/contacts',  icon: BookUser,      label: 'Kontak',            adminOnly: false, mobile: true },
  { path: '/templates', icon: Zap,           label: 'Template & Galeri', short: 'Template',  adminOnly: false },
  { path: '/broadcast', icon: Megaphone,     label: 'Broadcast Promo',   short: 'Broadcast', adminOnly: true },
  { path: '/qr',        icon: QrCode,        label: 'QR Setup',          short: 'QR Setup',  adminOnly: true },
]

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
  const [showMore, setShowMore] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const accountRef = useRef(null)
  useEffect(() => {
    if (!showAccount) return
    const onDown = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccount(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showAccount])
  const panelRef = useRef(null)
  // Permintaan nomor: admin -> yang menunggu; agent -> hasil yang belum dilihat
  const [numberReqs, setNumberReqs] = useState([])
  const [nrSeen, setNrSeen] = useState(loadSeen)
  const [notifStatus, setNotifStatus] = useState('granted') // sembunyikan tombol default
  const [enabling, setEnabling] = useState(false)

  useEffect(() => { setNotifStatus(getNotificationStatus()) }, [])
  // Pindah halaman -> tutup popup
  useEffect(() => { setShowReminders(false); setShowMore(false) }, [location.pathname])

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
    if (isAdmin) return // admin memantau follow-up dari menu Follow-up
    try {
      const d = await getFollowupDue()
      setDueTasks(Array.isArray(d?.tasks) ? d.tasks : [])
      setDueCount(d?.count || 0)
    } catch {}
  }, [isAdmin])

  const loadNumberReqs = useCallback(async () => {
    try {
      const rows = await getNumberRequests(isAdmin ? 'pending' : 'all')
      setNumberReqs(Array.isArray(rows) ? rows : [])
    } catch {}
  }, [isAdmin])
  useEffect(() => {
    loadNumberReqs()
    const interval = setInterval(loadNumberReqs, 120000)
    window.addEventListener('nr:changed', loadNumberReqs)
    return () => { clearInterval(interval); window.removeEventListener('nr:changed', loadNumberReqs) }
  }, [loadNumberReqs])
  // Agent: hasil 7 hari terakhir yang belum dilihat
  const nrResults = isAdmin ? [] : numberReqs.filter(r => r.status !== 'pending' && Date.now() - new Date(r.handled_at || r.created_at).getTime() < 7 * 86400000)
  const nrUnseen = nrResults.filter(r => !nrSeen.has(r.id))
  const nrList = isAdmin ? numberReqs : nrResults
  const nrCount = isAdmin ? numberReqs.length : nrUnseen.length
  const bellCount = isAdmin ? nrCount : dueCount + nrCount
  // Panel dibuka -> hasil permintaan dianggap sudah dilihat
  useEffect(() => {
    if (!showReminders || isAdmin || !nrUnseen.length) return
    const next = new Set(nrSeen); nrUnseen.forEach(r => next.add(r.id)); setNrSeen(next); saveSeen(next)
  }, [showReminders, isAdmin, nrUnseen, nrSeen])

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

  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)
  const moreItems = navItems.filter(i => !i.mobile)
  const needNotif = notifStatus !== 'granted' && notifStatus !== 'unsupported'
  const isActive = (path) => location.pathname === path || (path === '/inbox' && location.pathname.startsWith('/chat/'))
  const moreActive = moreItems.some(i => isActive(i.path))

  return (
    <div className="icon-bar">
      <div className="ib-top">
        <div className="ib-logo">R</div>

        {navItems.map(({ path, icon: Icon, label, short, mobile }) => (
          <button key={path} className={`ib-btn${isActive(path) ? ' active' : ''}${mobile ? '' : ' ib-desk-only'}`}
            onClick={() => navigate(path)} aria-label={label} data-tip={label}>
            <Icon size={19} />
            <span className="ib-label">{short || label}</span>
          </button>
        ))}
      </div>

      <div className="ib-bottom">
        {needNotif && (
          <button className={`ib-btn ib-notif-enable ib-desk-only`} onClick={handleEnableNotif} disabled={enabling}
            aria-label="Aktifkan notifikasi pesan baru" data-tip="Aktifkan notifikasi">
            <BellRing size={18} />
            <span className="ib-notif-dot" />
            <span className="ib-label">Notifikasi</span>
          </button>
        )}
        <div className="ib-reminder-wrap" ref={panelRef}>
          <button className={`ib-btn ib-bell-btn${showReminders ? ' open' : ''}`} onClick={() => { setShowReminders(s => !s); setShowMore(false); if (!showReminders) { loadDue(); loadNumberReqs() } }}
            aria-label={isAdmin ? 'Permintaan nomor' : 'Pengingat'} data-tip={isAdmin ? 'Permintaan nomor' : 'Pengingat'}>
            <Bell size={18} />
            {bellCount > 0 && <span className="ib-badge">{bellCount > 9 ? '9+' : bellCount}</span>}
            <span className="ib-label">Pengingat</span>
          </button>
          {showReminders && (
            <div className="ib-reminder-panel">
              <div className="ib-reminder-panel-title">
                <span>{isAdmin ? 'Permintaan nomor customer' : 'Pengingat'}</span>
                <button className="ib-panel-close" onClick={() => setShowReminders(false)} aria-label="Tutup"><X size={16} /></button>
              </div>
              {/* Admin: hanya permintaan nomor (follow-up ada di menu Follow-up) */}
              {isAdmin && nrList.length === 0 && (
                <div className="ib-reminder-empty"><CheckCircle2 size={26} strokeWidth={1.5} /><span>Tidak ada permintaan nomor dari agent.</span></div>
              )}
              {nrList.length > 0 && (
                <div className={`ib-nr${isAdmin ? ' full' : ''}`}>
                  {!isAdmin && <div className="ib-nr-title"><Phone size={13} />Hasil permintaan nomor</div>}
                  {isAdmin ? nrList.map(r => (
                    <NumberRequestAdminItem key={r.id} r={r} onDone={loadNumberReqs} onOpen={() => { setShowReminders(false); navigate(`/chat/${r.conversation_id}`) }} />
                  )) : nrList.map(r => (
                    <button key={r.id} className={`ib-reminder-item${nrSeen.has(r.id) ? '' : ' unseen'}`} onClick={() => { setShowReminders(false); navigate(`/chat/${r.conversation_id}`) }}>
                      <div className="ib-reminder-info">
                        <span className="ib-reminder-name">{r.contact?.name || 'Customer'}</span>
                        <span className="ib-reminder-time">{r.status === 'done' ? `Nomor: ${r.number}` : `Ditolak: ${r.reason || '-'}`}</span>
                      </div>
                      <span className={`ib-nr-st ${r.status}`}>{r.status === 'done' ? 'Diisi' : 'Ditolak'}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Agent: follow-up yang ditugaskan */}
              {!isAdmin && (<>
              <div className="ib-nr-title ib-fu-title"><ListChecks size={13} />Follow-up jatuh tempo{dueCount ? ` (${dueCount})` : ''}</div>
              {dueTasks.length === 0 ? (
                <div className="ib-reminder-empty"><CheckCircle2 size={26} strokeWidth={1.5} /><span>Tidak ada follow-up yang jatuh tempo.</span></div>
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
                          </span>
                          {t.step === 'manual' && t.note && <span className="ib-reminder-time">{t.note}</span>}
                        </div>
                        <span className={`ib-fu-due ${dueTone(t)}`}>{dueLabel(t)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              </>)}
            </div>
          )}
        </div>
        <div className={`ib-dot ${waConnected ? 'online' : 'offline'}`} title={waConnected ? 'WA Connected' : 'WA Disconnected'} />
        <div className="ib-account" ref={accountRef}>
          <button className="ib-user-chip" onClick={() => { setShowAccount(v => !v); setShowReminders(false) }}
            aria-label="Akun" aria-expanded={showAccount} title={showAccount ? undefined : `${user?.name || ''} (${isAdmin ? 'Admin' : 'Agent'})`}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </button>
          {showAccount && (
            <div className="ib-account-menu">
              <div className="ib-account-id">
                <b>{user?.name || 'Pengguna'}</b>
                <small>{user?.username ? `@${user.username} · ` : ''}{isAdmin ? 'Admin' : 'Agent'}</small>
              </div>
              <button onClick={() => { setShowAccount(false); setShowPwd(true) }}><KeyRound size={15} /> Ubah kata sandi</button>
              <button className="danger" onClick={handleLogout}><LogOut size={15} /> Keluar</button>
            </div>
          )}
        </div>
        {/* HP: menu Lainnya selalu ada (menu admin tambahan + akun) */}
        <button className={`ib-btn ib-more-btn${moreActive || showMore ? ' active' : ''}`} onClick={() => { setShowMore(true); setShowReminders(false) }} aria-label="Menu lainnya">
          <LayoutGrid size={18} />
          {needNotif && <span className="ib-notif-dot" />}
          <span className="ib-label">Lainnya</span>
        </button>
      </div>

      {/* HP: menu lainnya (bottom sheet) */}
      {showMore && (
        <div className="ib-sheet-overlay" onClick={() => setShowMore(false)}>
          <div className="ib-sheet" onClick={e => e.stopPropagation()}>
            <div className="ib-sheet-head">
              <div className="ib-sheet-user">
                <span className="ib-sheet-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                <span>
                  <b>{user?.name || 'Pengguna'}</b>
                  <small><span className={`ib-sheet-wa ${waConnected ? 'on' : ''}`} />{isAdmin ? 'Admin' : 'Agent'} · WA {waConnected ? 'terhubung' : 'terputus'}</small>
                </span>
              </div>
              <button className="ib-panel-close" onClick={() => setShowMore(false)} aria-label="Tutup"><X size={18} /></button>
            </div>
            {moreItems.length > 0 && (
              <div className="ib-sheet-grid">
                {moreItems.map(({ path, icon: Icon, label }) => (
                  <button key={path} className={`ib-sheet-item${isActive(path) ? ' active' : ''}`} onClick={() => navigate(path)}>
                    <span className="ib-sheet-ico"><Icon size={20} /></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            {needNotif && (
              <button className="ib-sheet-row" onClick={handleEnableNotif} disabled={enabling}><BellRing size={17} /> Aktifkan notifikasi pesan baru</button>
            )}
            <button className="ib-sheet-row" onClick={() => { setShowMore(false); setShowPwd(true) }}><KeyRound size={17} /> Ubah kata sandi</button>
            <button className="ib-sheet-row danger" onClick={handleLogout}><LogOut size={17} /> Keluar</button>
          </div>
        </div>
      )}

      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}

      <style>{`
        .ib-account { position: relative; }
        .ib-account .ib-user-chip { cursor: pointer; transition: box-shadow 0.15s; }
        .ib-account .ib-user-chip:hover, .ib-account .ib-user-chip[aria-expanded="true"] { box-shadow: 0 0 0 2px var(--primary); }
        .ib-account-menu { position: absolute; left: calc(100% + 12px); bottom: -4px; width: 220px; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 16px 40px var(--shadow), 0 2px 8px var(--shadow); z-index: 300; animation: ibPop 0.14s ease-out; }
        .ib-account-id { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 10px; margin-bottom: 4px; border-bottom: 1px solid var(--border); }
        .ib-account-id b { font-size: 13.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-account-id small { font-size: 11.5px; color: var(--muted); }
        .ib-account-menu button { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px; font-size: 13px; color: var(--text); text-align: left; }
        .ib-account-menu button svg { color: var(--muted); }
        .ib-account-menu button:hover { background: var(--surface3); }
        .ib-account-menu button.danger, .ib-account-menu button.danger svg { color: var(--danger, #e53e3e); }
        .ib-logo { width: 34px; height: 34px; border-radius: 10px; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; color: var(--on-primary); margin-bottom: 16px; flex-shrink: 0; }
        .ib-label { display: none; }
        .ib-more-btn { display: none; }
        .ib-reminder-wrap { position: relative; }
        .ib-bell-btn { position: relative; }
        .ib-bell-btn.open { background: var(--primary-light); color: var(--primary); }
        .ib-badge { position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px; border-radius: 999px; background: var(--danger, #e53e3e); color: var(--on-primary); font-size: 9.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 4px; line-height: 1; border: 2px solid var(--sidebar-bg); }
        .ib-notif-enable { position: relative; color: var(--warning, #d08b28); }
        .ib-notif-enable:hover { background: rgba(208,139,40,0.12); color: var(--warning, #d08b28); }
        .ib-notif-enable:disabled { opacity: 0.6; cursor: not-allowed; }
        .ib-notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--warning, #d08b28); animation: pulse 1.6s ease infinite; }
        /* Tooltip label (desktop) */
        @media (hover: hover) and (min-width: 769px) {
          .ib-btn[data-tip]::after { content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; transform: translate(-4px, -50%); padding: 5px 9px; border-radius: 7px; background: var(--text); color: var(--surface); font-size: 12px; font-weight: 600; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.12s, transform 0.12s; z-index: 400; box-shadow: 0 4px 12px var(--shadow); }
          .ib-btn[data-tip]:hover::after { opacity: 1; transform: translate(0, -50%); }
          .ib-bell-btn.open::after { display: none; }
        }
        /* Panel lonceng (desktop: di kanan tombol) */
        .ib-reminder-panel { position: absolute; left: calc(100% + 12px); bottom: -6px; width: 320px; max-height: min(480px, calc(100vh - 40px)); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 16px 40px var(--shadow), 0 2px 8px var(--shadow); z-index: 300; overflow: hidden; animation: ibPop 0.14s ease-out; }
        @keyframes ibPop { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .ib-reminder-panel-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 10px 10px 14px; font-size: 13px; font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .ib-panel-close { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); flex-shrink: 0; }
        .ib-panel-close:hover { background: var(--surface3); color: var(--text2); }
        .ib-reminder-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 16px; font-size: 12.5px; color: var(--muted); text-align: center; }
        .ib-reminder-empty svg { color: var(--success); }
        .ib-reminder-list { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
        .ib-reminder-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
        .ib-reminder-item:last-child { border-bottom: none; }
        .ib-reminder-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ib-reminder-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-reminder-note { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: var(--text2); }
        .ib-reminder-agent { color: var(--muted); }
        .ib-reminder-time { font-size: 11px; color: var(--muted); }
        button.ib-reminder-item { width: 100%; text-align: left; cursor: pointer; }
        button.ib-reminder-item:hover { background: var(--surface3); }
        .ib-fu-step { display: inline-block; color: #fff; font-size: 9.5px; font-weight: 800; letter-spacing: .3px; padding: 1px 7px; border-radius: 999px; }
        .ib-fu-due { flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--text2); }
        .ib-fu-due.today { color: #d97706; } .ib-fu-due.late { color: var(--danger, #e53e3e); }
        .ib-nr { flex-shrink: 0; max-height: 55%; overflow-y: auto; border-bottom: 1px solid var(--border); background: var(--surface2); }
        .ib-nr-title { display: flex; align-items: center; gap: 6px; padding: 8px 14px 4px; font-size: 11.5px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: .3px; }
        .ib-fu-title { flex-shrink: 0; padding-top: 10px; }
        .ib-nr.full { max-height: none; flex: 1; min-height: 0; border-bottom: none; background: transparent; }
        .ib-nr-item { padding: 8px 14px 10px; border-bottom: 1px solid var(--border); }
        .ib-nr-item:last-child { border-bottom: none; }
        .ib-nr-head { display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left; min-width: 0; font-size: 11.5px; }
        .ib-nr-head:hover .ib-reminder-name { color: var(--primary); text-decoration: underline; }
        .ib-nr-note { margin-top: 3px; font-size: 11.5px; color: var(--text2); font-style: italic; }
        .ib-nr-actions { display: flex; gap: 6px; margin-top: 7px; }
        .ib-nr-actions input { flex: 1; min-width: 0; height: 30px; padding: 0 9px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 12.5px; }
        .ib-nr-actions button { height: 30px; padding: 0 10px; border-radius: 8px; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .ib-nr-actions button:disabled { opacity: .5; }
        .ib-nr-ok { background: var(--primary); color: var(--on-primary, #fff); }
        .ib-nr-no { background: rgba(229,62,62,0.12); color: var(--danger, #e53e3e); }
        .ib-nr-cancel { color: var(--text2); background: var(--surface3); }
        .ib-nr-err { margin-top: 5px; font-size: 11.5px; color: var(--danger, #e53e3e); }
        .ib-nr-st { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
        .ib-nr-st.done { background: rgba(16,185,129,0.14); color: #10b981; }
        .ib-nr-st.rejected { background: rgba(229,62,62,0.12); color: var(--danger, #e53e3e); }
        .ib-reminder-item.unseen .ib-reminder-name::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--primary); margin-right: 6px; vertical-align: middle; }
        .ib-reminder-all { width: 100%; padding: 11px 14px; font-size: 12.5px; font-weight: 700; color: var(--primary); border-top: 1px solid var(--border); text-align: center; flex-shrink: 0; }
        .ib-reminder-all:hover { background: var(--surface3); }
        .ib-fu-alert { width: 100%; display: flex; align-items: flex-start; gap: 8px; padding: 9px 14px; text-align: left; color: var(--danger, #e53e3e); background: rgba(229,62,62,0.08); border-bottom: 1px solid var(--border); cursor: pointer; flex-shrink: 0; }
        .ib-fu-alert span { display: flex; flex-direction: column; gap: 1px; font-size: 12px; min-width: 0; }
        .ib-fu-alert small { font-size: 11px; color: var(--text2); }
        .ib-fu-alert:hover { background: rgba(229,62,62,0.14); }
        /* Bottom sheet "Lainnya" (HP) */
        .ib-sheet-overlay { position: fixed; inset: 0; z-index: 650; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; animation: ibFade 0.15s ease; }
        @keyframes ibFade { from { opacity: 0; } to { opacity: 1; } }
        .ib-sheet { width: 100%; max-width: 520px; background: var(--surface); border-radius: 18px 18px 0 0; padding: 14px 14px max(14px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; animation: ibUp 0.2s ease-out; }
        @keyframes ibUp { from { transform: translateY(100%); } to { transform: none; } }
        .ib-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 2px 4px; }
        .ib-sheet-user { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ib-sheet-user > span:last-child { display: flex; flex-direction: column; min-width: 0; }
        .ib-sheet-user b { font-size: 14px; color: var(--text); }
        .ib-sheet-user small { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
        .ib-sheet-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .ib-sheet-wa { width: 7px; height: 7px; border-radius: 50%; background: var(--border2); }
        .ib-sheet-wa.on { background: var(--success); }
        .ib-sheet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .ib-sheet-item { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 14px 6px 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); font-size: 12px; font-weight: 600; color: var(--text2); text-align: center; }
        .ib-sheet-item.active { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
        .ib-sheet-ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--surface); color: var(--primary); }
        .ib-sheet-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--surface2); font-size: 14px; font-weight: 600; color: var(--text2); }
        .ib-sheet-row.danger { color: var(--danger, #e53e3e); }
        .ib-sheet-row:disabled { opacity: 0.6; }

        @media (max-width: 768px) {
          .ib-desk-only { display: none !important; }
          .ib-more-btn { display: flex; }
          .ib-label { display: block; font-size: 10px; font-weight: 600; line-height: 1; margin-top: 3px; white-space: nowrap; }
          .icon-bar .ib-btn { flex-direction: column; width: 58px; height: 46px; gap: 0; border-radius: 12px; }
          /* Menu aktif di HP: cukup latar abu (tanpa pil/teks biru), sama seperti desktop */
          .icon-bar .ib-btn.active { background: var(--surface3); color: var(--text); }
          .icon-bar .ib-btn svg { padding: 3px 10px; width: 44px; height: 26px; box-sizing: border-box; }
          .ib-badge { top: -1px; right: 8px; }
          .ib-notif-dot { top: 2px; right: 14px; }
          /* Popup lonceng: di tengah layar, di atas navbar */
          .ib-reminder-panel { position: fixed; left: 12px; right: 12px; bottom: calc(70px + env(safe-area-inset-bottom)); width: auto; max-width: 440px; margin: 0 auto; max-height: min(70vh, 560px); }
        }
      `}</style>
    </div>
  )
}

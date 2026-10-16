import { useEffect } from 'react'
import { useSocket } from '../context/SocketContext'
import { RefreshCw, CheckCircle2, Wifi, WifiOff, AlertTriangle, QrCode, Smartphone, LogOut } from 'lucide-react'
import { resetWASession } from '../hooks/useApi'
const BACKEND_URL = 'wa-dashboard-backend-production.up.railway.app'

const STEPS = [
  <>Buka <b>WhatsApp</b> di HP yang dipakai untuk bisnis.</>,
  <>Ketuk <b>Opsi lainnya</b> (titik tiga) atau <b>Setelan</b>.</>,
  <>Pilih <b>Perangkat tertaut</b>, lalu <b>Tautkan perangkat</b>.</>,
  <>Arahkan kamera HP ke kode QR di halaman ini.</>,
]

export default function QRSetupPage() {
  const { qrCode, waConnected, socketConnected, socketError, setQrCode, socket } = useSocket()

  // Minta QR terbaru saat halaman dibuka / socket tersambung (bila WA belum connect).
  useEffect(() => {
    if (socket && socketConnected && !waConnected) socket.emit('request_qr')
  }, [socket, socketConnected, waConnected])

  const handleRefresh = () => {
    setQrCode(null)
    if (socket && socketConnected) socket.emit('request_qr')
  }

  const handleReset = async () => {
    if (!window.confirm('Putuskan WhatsApp & reset sesi? Setelah ini perlu scan QR ulang.')) return
    try { await resetWASession() } catch { alert('Reset sesi gagal, coba lagi.') }
  }

  const statusText = socketError ? 'Server tidak terjangkau, mencoba lagi…'
    : socketConnected ? 'Menunggu kode QR dari server…' : 'Menghubungkan ke server…'

  return (
    <div className="qr-page">
      <div className="qr-header">
        <h1><QrCode size={21} />Koneksi WhatsApp</h1>
        <span className={`qr-pill ${waConnected ? 'on' : 'off'}`}>
          <span className="qr-pill-dot" />{waConnected ? 'Terhubung' : 'Belum terhubung'}
        </span>
      </div>

      {socketError && (
        <div className="qr-alert">
          <AlertTriangle size={17} />
          <div>
            <b>Tidak bisa terhubung ke server.</b>
            <span>Pastikan server backend menyala dan koneksi internet stabil. Detail: <code>{socketError}</code></span>
          </div>
        </div>
      )}

      {waConnected ? (
        <div className="qr-card qr-connected">
          <div className="qr-ok-icon"><CheckCircle2 size={40} /></div>
          <h2>WhatsApp terhubung</h2>
          <p>Akun WhatsApp bisnis aktif dan sedang menerima pesan.</p>
          <span className="qr-live"><Wifi size={14} /> Live</span>
          <div className="qr-divider" />
          <div className="qr-reset">
            <div>
              <b>Ganti nomor atau perangkat?</b>
              <span>Putuskan sesi ini, lalu scan QR ulang dengan nomor yang baru.</span>
            </div>
            <button className="qr-btn danger" onClick={handleReset}><LogOut size={15} /> Putuskan & reset sesi</button>
          </div>
        </div>
      ) : (
        <div className="qr-grid">
          <div className="qr-card qr-scan">
            <div className={`qr-status ${socketError ? 'error' : socketConnected ? 'waiting' : 'idle'}`}>
              {socketError ? <AlertTriangle size={14} /> : socketConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{qrCode ? 'Kode QR siap dipindai' : statusText}</span>
            </div>
            <div className={`qr-frame${socketError ? ' error' : ''}${qrCode ? ' ready' : ''}`}>
              {qrCode ? (
                <img src={qrCode} alt="Kode QR WhatsApp" className="qr-image" />
              ) : (
                <div className="qr-placeholder">
                  <div className="qr-dots">
                    {[...Array(9)].map((_, i) => <div key={i} className="qr-dot" style={{ animationDelay: `${i * 0.1}s` }} />)}
                  </div>
                  <p>{statusText}</p>
                </div>
              )}
            </div>
            <button className="qr-btn" onClick={handleRefresh}><RefreshCw size={15} /> Muat ulang QR</button>
            <span className="qr-note">Kode QR berganti otomatis setiap beberapa detik.</span>
          </div>

          <div className="qr-side">
            <div className="qr-card">
              <h3><Smartphone size={16} /> Cara menghubungkan</h3>
              <ol className="qr-steps">
                {STEPS.map((s, i) => (
                  <li key={i}><span className="qr-step-num">{i + 1}</span><span>{s}</span></li>
                ))}
              </ol>
            </div>

            <details className="qr-card qr-tech">
              <summary>Detail teknis</summary>
              <div className="qr-tech-rows">
                <div><span>Koneksi ke server</span><b className={socketConnected ? 'ok' : 'fail'}>{socketConnected ? 'Terhubung' : 'Terputus'}</b></div>
                <div><span>Status WhatsApp</span><b className={waConnected ? 'ok' : 'fail'}>{waConnected ? 'Terhubung' : 'Belum terhubung'}</b></div>
                {socketError && <div><span>Error</span><b className="fail">{socketError}</b></div>}
                <div><span>Server</span><code>{BACKEND_URL}</code></div>
              </div>
            </details>
          </div>
        </div>
      )}

      <style>{`
        .qr-page { padding: 24px 24px 40px; width: 100%; max-width: 980px; color: var(--text); }
        .qr-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
        .qr-header h1 { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; }
        .qr-pill { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
        .qr-pill-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .qr-pill.on { color: var(--success); background: rgba(39,168,122,0.14); }
        .qr-pill.on .qr-pill-dot { box-shadow: 0 0 0 3px rgba(39,168,122,0.25); }
        .qr-pill.off { color: var(--warning); background: rgba(208,139,40,0.14); }
        .qr-alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; margin-bottom: 16px; border-radius: 12px; background: rgba(208,139,40,0.1); border: 1px solid rgba(208,139,40,0.3); color: var(--warning); }
        .qr-alert svg { flex-shrink: 0; margin-top: 1px; }
        .qr-alert div { display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
        .qr-alert span { color: var(--text2); font-size: 12.5px; line-height: 1.5; }
        .qr-alert code { font-size: 11.5px; color: var(--danger); }
        .qr-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px var(--shadow); }
        .qr-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .qr-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .qr-scan { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
        .qr-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .qr-status.idle { background: var(--surface3); color: var(--text2); }
        .qr-status.waiting { background: var(--primary-light); color: var(--primary); }
        .qr-status.error { background: rgba(208,139,40,0.14); color: var(--warning); }
        .qr-frame { width: 264px; height: 264px; max-width: 100%; aspect-ratio: 1; background: #fff; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 3px solid var(--border2); overflow: hidden; padding: 10px; }
        .qr-frame.ready { border-color: var(--success); }
        .qr-frame.error { border-color: var(--warning); }
        .qr-image { width: 100%; height: 100%; object-fit: contain; }
        .qr-placeholder { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .qr-dots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .qr-dot { width: 24px; height: 24px; background: #cbd5e1; border-radius: 5px; animation: qrPulse 1.5s ease infinite; }
        @keyframes qrPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .qr-placeholder p { font-size: 12px; color: #64748b; max-width: 200px; line-height: 1.45; }
        .qr-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--text2); background: var(--surface2); border: 1px solid var(--border); transition: all 0.15s; white-space: nowrap; }
        .qr-btn:hover { background: var(--surface3); }
        .qr-btn.danger { color: var(--danger); background: rgba(229,62,62,0.08); border-color: rgba(229,62,62,0.3); }
        .qr-btn.danger:hover { background: rgba(229,62,62,0.14); }
        .qr-note { font-size: 11.5px; color: var(--muted); }
        .qr-card h3 { display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; margin-bottom: 14px; }
        .qr-card h3 svg { color: var(--primary); }
        .qr-steps { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .qr-steps li { display: flex; gap: 11px; align-items: flex-start; font-size: 13.5px; color: var(--text2); line-height: 1.5; }
        .qr-steps b { color: var(--text); }
        .qr-step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .qr-tech { padding: 0; }
        .qr-tech summary { cursor: pointer; padding: 14px 20px; font-size: 13px; font-weight: 600; color: var(--text2); list-style-position: inside; }
        .qr-tech[open] summary { border-bottom: 1px solid var(--border); }
        .qr-tech-rows { display: flex; flex-direction: column; }
        .qr-tech-rows > div { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 9px 20px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
        .qr-tech-rows > div:last-child { border-bottom: none; }
        .qr-tech-rows span { color: var(--muted); flex-shrink: 0; }
        .qr-tech-rows b { font-weight: 600; text-align: right; }
        .qr-tech-rows .ok { color: var(--success); } .qr-tech-rows .fail { color: var(--danger); }
        .qr-tech-rows code { font-size: 11px; color: var(--text2); word-break: break-all; text-align: right; }
        .qr-connected { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 32px 24px; max-width: 560px; }
        .qr-ok-icon { width: 76px; height: 76px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(39,168,122,0.14); color: var(--success); margin-bottom: 4px; }
        .qr-connected h2 { font-size: 20px; font-weight: 700; }
        .qr-connected p { font-size: 13.5px; color: var(--text2); }
        .qr-live { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--success); background: rgba(39,168,122,0.14); }
        .qr-divider { width: 100%; height: 1px; background: var(--border); margin: 10px 0 6px; }
        .qr-reset { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 14px; text-align: left; }
        .qr-reset div { display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
        .qr-reset span { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
        @media (max-width: 820px) {
          .qr-page { padding: 16px 14px 28px; }
          .qr-grid { grid-template-columns: 1fr; }
          .qr-reset { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  )
}

import { useEffect } from 'react'
import { useSocket } from '../context/SocketContext'
import { RefreshCw, CheckCircle, Wifi, WifiOff, AlertTriangle, ServerOff } from 'lucide-react'
import { resetWASession } from '../hooks/useApi'
const BACKEND_URL = 'wa-dashboard-backend-production.up.railway.app'

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

  return (
    <div className="qr-page fade-in">
      <div className="page-header">
        <h1>WhatsApp Connection</h1>
        <p>Scan the QR code with your WhatsApp to connect</p>
      </div>

      {/* CORS / connection error banner */}
      {socketError && (
        <div className="backend-error-banner">
          <AlertTriangle size={18} style={{flexShrink:0, marginTop:2}} />
          <div style={{flex:1, minWidth:0}}>
            <strong>
              {socketError === 'server error' ? 'CORS error — backend is reachable but rejecting the connection' : 'Backend connection error'}
            </strong>
            <p>
              Error: <span className="error-detail">{socketError}</span>
              {socketError === 'server error' && ' (parser error — server returned non-Socket.io response, usually a CORS rejection)'}
            </p>
            {socketError === 'server error' && (
              <div className="cors-fix">
                <p className="cors-fix-title">Add this to your backend Node.js server:</p>
                <pre>{`// 1. Install: npm install cors
const cors = require('cors')
app.use(cors({ origin: '*' }))   // or specific origin

// 2. Socket.io CORS (in Server constructor):
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
})`}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="qr-container">
        {waConnected ? (
          <div className="connected-state">
            <div className="connected-icon">
              <CheckCircle size={48} />
            </div>
            <h2>WhatsApp Connected</h2>
            <p>Your WhatsApp Business account is active and receiving messages.</p>
            <div className="badge" style={{background: 'rgba(37,211,102,0.15)', color: 'var(--green)', padding: '6px 16px', fontSize: '13px', gap: '6px', display: 'inline-flex', alignItems: 'center', borderRadius: '20px', fontWeight: 600}}>
              <Wifi size={14} />
              <span>Live</span>
            </div>

            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (!window.confirm('Reset sesi WhatsApp? Harus scan QR ulang.')) return;
                try { await resetWASession(); } catch(e) { alert('Reset gagal'); }
              }}
              style={{marginTop: '8px', color: 'var(--red)'}}>
              Disconnect & Reset Session
            </button>
          </div>
        ) : (
          <div className="qr-state">
            <div className={`qr-status ${socketConnected ? 'waiting' : socketError ? 'error' : 'disconnected'}`}>
              {socketError
                ? <><AlertTriangle size={14} /><span>Backend unreachable — retrying…</span></>
                : socketConnected
                  ? <><Wifi size={14} /><span>Socket connected — waiting for QR</span></>
                  : <><WifiOff size={14} /><span>Connecting to backend…</span></>
              }
            </div>

            <div className={`qr-frame ${socketError ? 'error-frame' : ''}`}>
              {qrCode ? (
                <img src={qrCode} alt="WhatsApp QR Code" className="qr-image" />
              ) : (
                <div className="qr-placeholder">
                  <div className="qr-loading">
                    <div className="qr-dots">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="qr-dot" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                    <p>
                      {socketError
                        ? 'Backend offline — retrying connection…'
                        : socketConnected
                          ? 'Waiting for QR from backend…'
                          : 'Connecting to backend…'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="qr-actions">
              <button className="btn btn-secondary" onClick={handleRefresh}>
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>

            <div className="qr-instructions">
              <h3>How to connect</h3>
              <ol>
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Tap <strong>More options</strong> (three dots) or <strong>Settings</strong></li>
                <li>Select <strong>Linked Devices</strong> then <strong>Link a Device</strong></li>
                <li>Scan the QR code above</li>
              </ol>
            </div>

            <div className="debug-info">
              <h3>Connection debug</h3>
              <div className="debug-row">
                <span>Socket.io connection</span>
                <span className={socketConnected ? 'ok' : 'fail'}>
                  {socketConnected ? '✓ Connected' : '✗ Not connected'}
                </span>
              </div>
              <div className="debug-row">
                <span>WhatsApp status</span>
                <span className={waConnected ? 'ok' : 'fail'}>
                  {waConnected ? '✓ Connected' : '✗ Disconnected'}
                </span>
              </div>
              {socketError && (
                <div className="debug-row error-row">
                  <span>Error</span>
                  <span>{socketError}</span>
                </div>
              )}
              <div className="debug-row">
                <span>Backend URL</span>
                <span className="url-val">{BACKEND_URL}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .qr-page {
          padding: 32px;
          max-width: 620px;
          margin: 0 auto;
        }
        .page-header { margin-bottom: 20px; }
        .page-header h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .page-header p { color: var(--text-muted); font-size: 14px; }

        .backend-error-banner {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: rgba(255,165,2,0.08);
          border: 1px solid rgba(255,165,2,0.25);
          border-radius: var(--radius-sm);
          padding: 14px 16px;
          margin-bottom: 20px;
          color: var(--orange);
        }
        .backend-error-banner svg { flex-shrink: 0; margin-top: 2px; }
        .backend-error-banner strong { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .backend-error-banner p { font-size: 12px; line-height: 1.6; color: var(--text-muted); }
        .backend-error-banner code {
          font-family: monospace;
          background: rgba(255,255,255,0.05);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 11px;
          color: var(--text);
          word-break: break-all;
        }
        .error-detail { color: var(--red); font-size: 11px; }

        .qr-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 32px;
        }
        .connected-state {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .connected-icon { color: var(--green); }
        .connected-state h2 { font-size: 22px; font-weight: 700; }
        .connected-state p { color: var(--text-muted); max-width: 320px; }

        .qr-state { display: flex; flex-direction: column; align-items: center; gap: 20px; }

        .qr-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .qr-status.disconnected { background: rgba(139,143,168,0.12); color: var(--text-muted); }
        .qr-status.waiting { background: rgba(61,142,248,0.12); color: var(--blue); }
        .qr-status.error { background: rgba(255,165,2,0.12); color: var(--orange); }

        .qr-frame {
          width: 260px;
          height: 260px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 4px solid var(--green);
          overflow: hidden;
        }
        .qr-frame.error-frame { border-color: var(--orange); }
        .qr-image { width: 100%; height: 100%; object-fit: contain; }
        .qr-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
        }
        .qr-loading { text-align: center; }
        .qr-dots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
          padding: 0 20px;
        }
        .qr-dot {
          width: 24px;
          height: 24px;
          background: #ccc;
          border-radius: 4px;
          animation: pulse 1.5s ease infinite;
        }
        .qr-loading p { font-size: 11px; color: #666; padding: 0 12px; line-height: 1.4; }

        .qr-instructions {
          width: 100%;
          background: var(--bg-hover);
          border-radius: var(--radius-sm);
          padding: 16px;
        }
        .qr-instructions h3 {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .qr-instructions ol {
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qr-instructions li { font-size: 13px; color: var(--text-muted); }
        .qr-instructions strong { color: var(--text); }

        .debug-info {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .debug-info h3 {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 12px;
          background: var(--bg-hover);
          border-bottom: 1px solid var(--border);
        }
        .debug-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 12px;
          font-size: 12px;
          border-bottom: 1px solid var(--border);
        }
        .debug-row:last-child { border-bottom: none; }
        .debug-row span:first-child { color: var(--text-muted); flex-shrink: 0; }
        .debug-row span:last-child { text-align: right; }
        .cors-fix {
          margin-top: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .cors-fix-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          padding: 6px 10px;
          background: var(--bg-hover);
          border-bottom: 1px solid var(--border);
          margin: 0;
        }
        .cors-fix pre {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #a8d8a8;
          padding: 10px 12px;
          margin: 0;
          overflow-x: auto;
          line-height: 1.6;
          white-space: pre;
        }
        .debug-row .ok { color: var(--green); font-weight: 600; }
        .debug-row .fail { color: var(--red); font-weight: 600; }
        .debug-row.error-row span:last-child { color: var(--red); }
        .url-val { color: var(--text-muted); font-family: monospace; font-size: 10px; word-break: break-all; }
      `}</style>
    </div>
  )
}

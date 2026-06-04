import { useSocket } from '../context/SocketContext'
import { RefreshCw, CheckCircle, Wifi, WifiOff } from 'lucide-react'

export default function QRSetupPage() {
  const { qrCode, waConnected, setQrCode } = useSocket()

  const handleRefresh = () => {
    setQrCode(null)
  }

  return (
    <div className="qr-page fade-in">
      <div className="page-header">
        <h1>WhatsApp Connection</h1>
        <p>Scan the QR code with your WhatsApp to connect</p>
      </div>

      <div className="qr-container">
        {waConnected ? (
          <div className="connected-state">
            <div className="connected-icon">
              <CheckCircle size={48} />
            </div>
            <h2>WhatsApp Connected</h2>
            <p>Your WhatsApp Business account is active and receiving messages.</p>
            <div className="badge badge-open" style={{background: 'rgba(37,211,102,0.15)', color: 'var(--green)', padding: '6px 16px', fontSize: '13px'}}>
              <Wifi size={14} />
              <span>Live</span>
            </div>
          </div>
        ) : (
          <div className="qr-state">
            <div className="qr-status disconnected">
              <WifiOff size={14} />
              <span>Waiting for connection</span>
            </div>

            <div className="qr-frame">
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
                    <p>Waiting for QR code from backend...</p>
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
          </div>
        )}
      </div>

      <style>{`
        .qr-page {
          padding: 32px;
          max-width: 600px;
          margin: 0 auto;
        }
        .page-header { margin-bottom: 32px; }
        .page-header h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .page-header p { color: var(--text-muted); font-size: 14px; }
        .qr-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 40px;
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
        .qr-state { display: flex; flex-direction: column; align-items: center; gap: 24px; }
        .qr-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .qr-status.disconnected {
          background: rgba(255,71,87,0.1);
          color: var(--red);
        }
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
          margin-bottom: 16px;
          padding: 0 20px;
        }
        .qr-dot {
          width: 24px;
          height: 24px;
          background: #ccc;
          border-radius: 4px;
          animation: pulse 1.5s ease infinite;
        }
        .qr-loading p { font-size: 12px; color: #666; padding: 0 16px; }
        .qr-instructions {
          width: 100%;
          background: var(--bg-hover);
          border-radius: var(--radius-sm);
          padding: 16px;
        }
        .qr-instructions h3 {
          font-size: 13px;
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
      `}</style>
    </div>
  )
}

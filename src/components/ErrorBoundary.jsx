import { Component } from 'react'
import { isChunkError, reloadOnceForChunkError } from '../lib/lazyPage'

// Menangkap error tampilan agar aplikasi tidak menjadi layar hitam/kosong.
// Error karena file versi lama (setelah deploy) -> muat ulang otomatis sekali.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkError(error)) reloadOnceForChunkError()
    else console.error('[UI] error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        flex: 1, minHeight: this.props.fullScreen ? '100vh' : 240, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
        background: 'var(--bg)', color: 'var(--text2)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Halaman gagal dimuat</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.5 }}>
          Kemungkinan ada versi aplikasi yang lebih baru. Muat ulang untuk melanjutkan.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ height: 38, padding: '0 18px', borderRadius: 10, background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 13.5, fontWeight: 600 }}
        >Muat ulang</button>
      </div>
    )
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// iOS mengabaikan interactive-widget: keyboard tidak menyusutkan layout,
// dokumen tergulir & header hilang. Ikat #root ke visual viewport (ikuti
// offsetTop & height) supaya header tetap di atas & input di atas keyboard.
// HANYA iOS — Android sudah beres via interactive-widget=resizes-content.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
if (isIOS && window.visualViewport) {
  const vv = window.visualViewport
  const root = document.getElementById('root')
  const syncViewport = () => {
    root.style.position = 'fixed'
    root.style.left = '0'
    root.style.right = '0'
    root.style.top = `${vv.offsetTop}px`
    root.style.height = `${vv.height}px`
  }
  vv.addEventListener('resize', syncViewport)
  vv.addEventListener('scroll', syncViewport)
  syncViewport()
}

// Nonaktifkan zoom secara konsisten di semua platform.
// iOS Safari: blokir gesture pinch WebKit (meta viewport sering diabaikan).
;['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
})
// Desktop (termasuk pinch trackpad Mac): Ctrl + scroll memicu zoom browser.
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
// Desktop: Ctrl/Cmd + (+ / - / 0) zoom via keyboard.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault()
}, { passive: false })
// Android: pinch-zoom dinonaktifkan lewat meta viewport (user-scalable=no).

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

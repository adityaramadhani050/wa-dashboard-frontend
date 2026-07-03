import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

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

// Pembaruan aplikasi (PWA) tanpa harus refresh berkali-kali.
//
// Service worker versi baru langsung aktif (skipWaiting + clientsClaim di
// vite.config). Halaman yang sedang terbuka lalu dimuat ulang ke versi baru pada
// saat yang aman agar pekerjaan (mis. draf balasan) tidak hilang:
//  - aplikasi baru dibuka (<= 15 detik)  -> langsung muat ulang
//  - pindah menu (navigasi), atau versi baru siap <= 10 detik setelah pindah
//    menu                               -> muat ulang ke menu tujuan
//  - aplikasi/tab disembunyikan         -> muat ulang di belakang layar
const isNative = () => !!window.Capacitor?.isNativePlatform?.()
const bootAt = Date.now()
let needRefresh = false
let registration = null
let lastCheck = 0
let lastNavAt = 0

function checkForUpdate() {
  if (!registration || Date.now() - lastCheck < 60 * 1000) return
  lastCheck = Date.now()
  registration.update().catch(() => {})
}

function applyUpdate() {
  if (!needRefresh) return
  needRefresh = false
  window.location.reload()
}

if (!isNative() && 'serviceWorker' in navigator) {
  // Pertama kali pasang service worker bukan "pembaruan" -> tidak perlu muat ulang
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return }
    needRefresh = true
    const now = Date.now()
    if (now - bootAt < 15 * 1000 || now - lastNavAt < 10 * 1000 || document.hidden) applyUpdate()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      registration = reg
      // Cek berkala; versi baru dipakai pada saat aman berikutnya
      setInterval(checkForUpdate, 15 * 60 * 1000)
    }).catch(() => {})
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) applyUpdate()
    else checkForUpdate()
  })
}

// Dipanggil setiap pindah halaman/menu.
export function onRouteChange() {
  lastNavAt = Date.now()
  if (needRefresh) applyUpdate()
  else checkForUpdate()
}

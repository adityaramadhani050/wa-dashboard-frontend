import { lazy } from 'react'

const KEY = 'chunk_reload_at'

// Setelah deploy, file halaman versi lama sudah tidak ada di server. Bila gagal
// dimuat, muat ulang aplikasi sekali (ambil versi terbaru) daripada layar kosong.
// Dibatasi 1x per 30 detik agar tidak terjadi muat ulang berulang.
export function isChunkError(err) {
  return /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError|MIME type/i
    .test(String(err?.message || err))
}

export function reloadOnceForChunkError() {
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch { /* storage diblokir */ }
  if (Date.now() - last < 30 * 1000) return false
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* abaikan */ }
  window.location.reload()
  return true
}

export function lazyPage(factory) {
  return lazy(() => factory().catch((err) => {
    if (isChunkError(err) && reloadOnceForChunkError()) {
      return new Promise(() => {}) // tunggu muat ulang
    }
    throw err
  }))
}

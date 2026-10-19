/* Handler Web Push — diimpor ke service worker (lewat workbox importScripts).
   Menampilkan notifikasi saat pesan masuk walau PWA tertutup. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'Pesan baru'
  const convId = (data.data && data.data.conversationId) || ''
  const url = (data.data && data.data.url) || ''
  const tag = (data.data && data.data.tag) || (convId ? `conv-${convId}` : undefined)
  const options = {
    body: data.body || 'Pesan baru masuk',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag,
    renotify: true,
    data: { conversationId: convId, url },
  }
  event.waitUntil((async () => {
    // App sedang dibuka & fokus: notifikasi in-app (socket) yang tampil. Push tetap
    // diteruskan ke halaman sebagai cadangan — bila socket melewatkan pesan ini,
    // halaman yang membunyikan notifikasi & menyinkronkan ulang.
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const focusedClients = clientsArr.filter((c) => c.visibilityState === 'visible' && c.focused)
    if (focusedClients.length) {
      focusedClients.forEach((c) => { try { c.postMessage({ type: 'push', payload: data }) } catch (e) {} })
      return
    }
    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const nd = event.notification.data || {}
  const convId = nd.conversationId
  const url = nd.url && nd.url.startsWith('/') ? nd.url : convId ? `/chat/${convId}` : '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      if ('focus' in client) {
        try { await client.navigate(url) } catch (e) {}
        return client.focus()
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

/* Handler Web Push — diimpor ke service worker (lewat workbox importScripts).
   Menampilkan notifikasi saat pesan masuk walau PWA tertutup. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'Pesan baru'
  const convId = (data.data && data.data.conversationId) || ''
  const options = {
    body: data.body || 'Pesan baru masuk',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: convId ? `conv-${convId}` : undefined,
    renotify: true,
    data: { conversationId: convId },
  }
  event.waitUntil((async () => {
    // Kalau app sedang dibuka & fokus, biarkan notifikasi in-app (socket) yang tampil
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const focused = clientsArr.some((c) => c.visibilityState === 'visible' && c.focused)
    if (focused) return
    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const convId = event.notification.data && event.notification.data.conversationId
  const url = convId ? `/chat/${convId}` : '/'
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

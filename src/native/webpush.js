// Web Push (VAPID) untuk PWA — notifikasi walau app tertutup.
// Hanya jalan di browser web (bukan native Capacitor, yang pakai FCM).
import { Capacitor } from '@capacitor/core'
import { getVapidPublicKey, registerDevice, unregisterDevice } from '../hooks/useApi'

let subscribed = false

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function supported() {
  return !Capacitor.isNativePlatform() &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

export async function initWebPush() {
  if (subscribed || !supported()) return
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const { key } = await getVapidPublicKey().catch(() => ({ key: null }))
      if (!key) return // server belum set VAPID
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
    }
    await registerDevice(JSON.stringify(sub), 'web')
    subscribed = true
  } catch (e) {
    console.warn('[WebPush] init gagal:', e?.message || e)
  }
}

export async function teardownWebPush() {
  if (!supported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await unregisterDevice(JSON.stringify(sub)).catch(() => {})
    subscribed = false
  } catch (e) {
    /* abaikan */
  }
}

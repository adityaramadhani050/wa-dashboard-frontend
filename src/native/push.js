// Integrasi push notification native (Capacitor + FCM). Aman/no-op di web.
import { Capacitor } from '@capacitor/core'

let initialized = false
let deviceToken = null

export function isNative() {
  return Capacitor.isNativePlatform()
}

export function getDeviceToken() {
  return deviceToken
}

// Inisialisasi sekali. onToken dipanggil saat FCM token tersedia.
export async function initPushNotifications({ onToken } = {}) {
  if (!isNative() || initialized) return
  initialized = true
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return

    await PushNotifications.register()

    await PushNotifications.addListener('registration', (token) => {
      deviceToken = token.value
      onToken?.(token.value)
    })
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[Push] registration error:', err?.error || err)
    })
    // Tap notifikasi → buka chat terkait
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const convId = action?.notification?.data?.conversationId
      if (convId) window.location.assign(`/chat/${convId}`)
    })
  } catch (e) {
    console.warn('[Push] init failed:', e?.message || e)
  }
}

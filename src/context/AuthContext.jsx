import { createContext, useContext, useState, useEffect } from 'react'
import api, { registerDevice, unregisterDevice } from '../hooks/useApi'
import { initPushNotifications, getDeviceToken, isNative } from '../native/push'

const AuthContext = createContext(null)

function loadUser() {
  try {
    const saved = localStorage.getItem('wa_user')
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (!parsed.role || !parsed.id) {
      localStorage.removeItem('wa_user')
      return null
    }
    return parsed
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  // Saat sudah login & di aplikasi native, daftarkan push token ke backend
  useEffect(() => {
    if (!user || !isNative()) return
    initPushNotifications({
      onToken: (token) => { registerDevice(token).catch(() => {}) },
    })
  }, [user])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    const userData = data.user
    localStorage.setItem('wa_user', JSON.stringify(userData))
    if (data.token) localStorage.setItem('wa_token', data.token)
    setUser(userData)
    return userData
  }

  const logout = () => {
    const dt = getDeviceToken()
    if (dt) unregisterDevice(dt).catch(() => {})
    localStorage.removeItem('wa_user')
    localStorage.removeItem('wa_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

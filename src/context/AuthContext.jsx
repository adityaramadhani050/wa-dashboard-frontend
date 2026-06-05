import { createContext, useContext, useState } from 'react'
import api from '../hooks/useApi'

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

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const userData = data.user
    localStorage.setItem('wa_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('wa_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

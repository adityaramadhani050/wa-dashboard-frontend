import { createContext, useContext, useState } from 'react'
import api from '../hooks/useApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const login = async (email) => {
    const { data } = await api.post('/auth/login', { email })
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

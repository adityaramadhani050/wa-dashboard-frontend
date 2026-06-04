import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const login = (email, password) => {
    const userData = { email, name: email.split('@')[0] }
    localStorage.setItem('wa_user', JSON.stringify(userData))
    setUser(userData)
    return true
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

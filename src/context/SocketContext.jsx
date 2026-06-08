import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [waConnected, setWaConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketError, setSocketError] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [newMessages, setNewMessages] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    const s = io(BACKEND_URL, {
      // Force WebSocket only — no polling fallback
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: false,
      timeout: 10000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      console.log(`[Socket] Connected ✓ id=${s.id}`)
      setSocketConnected(true)
      setSocketError(null)
    })

    s.on('connect_error', (err) => {
      console.error('[Socket] connect_error:', err.message)
      setSocketConnected(false)
      setSocketError(err.message || 'Connection error')
    })

    s.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason)
      setSocketConnected(false)
    })

    s.io.on('reconnect', (n) => {
      console.log(`[Socket] Reconnected after ${n} attempt(s)`)
      setSocketError(null)
    })

    s.io.on('reconnect_failed', () => {
      setSocketError('Failed to reconnect — check backend')
    })

    s.on('qr', (data) => {
      setQrCode(data)
      setWaConnected(false)
    })

    s.on('wa_status', (data) => {
      const connected = data === true || data?.connected === true
      setWaConnected(connected)
      if (connected) setQrCode(null)
    })

    s.on('new_message', (data) => {
      setNewMessages(prev => [...prev.slice(-99), data])
    })

    return () => s.disconnect()
  }, [])

  const clearNewMessages = () => setNewMessages([])

  return (
    <SocketContext.Provider value={{
      socket, socketConnected, socketError,
      waConnected, qrCode, setQrCode,
      newMessages, clearNewMessages,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

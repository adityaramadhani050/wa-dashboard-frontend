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
    console.log('[Socket] Connecting to:', BACKEND_URL)

    const s = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      withCredentials: false,
      timeout: 20000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      const transport = s.io.engine.transport.name
      console.log(`[Socket] Connected ✓  id=${s.id}  transport=${transport}`)
      setSocketConnected(true)
      setSocketError(null)
    })

    s.on('connect_error', (err) => {
      // Log the full error object for maximum detail
      console.error('[Socket] connect_error:', {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.type,
        data: err.data,
        stack: err.stack,
      })
      setSocketConnected(false)
      setSocketError(err.message || 'Unknown connection error')
    })

    s.on('disconnect', (reason, details) => {
      console.warn('[Socket] Disconnected:', {
        reason,
        // details available in Socket.io v4.1+
        message: details?.message,
        description: details?.description,
        context: details?.context,
      })
      setSocketConnected(false)
    })

    s.io.on('reconnect_attempt', (n) => {
      console.log(`[Socket] Reconnect attempt #${n} of 5`)
    })

    s.io.on('reconnect', (n) => {
      console.log(`[Socket] Reconnected after ${n} attempt(s)`)
      setSocketError(null)
    })

    s.io.on('reconnect_error', (err) => {
      console.error('[Socket] Reconnect error:', err.message)
    })

    s.io.on('reconnect_failed', () => {
      const msg = 'Failed to reconnect after 5 attempts — check backend is running and CORS is enabled'
      console.error('[Socket] ' + msg)
      setSocketError(msg)
    })

    s.on('qr', (data) => {
      console.log('[Socket] "qr" event received, data length:', typeof data === 'string' ? data.length : typeof data)
      setQrCode(data)
      setWaConnected(false)
    })

    s.on('wa_status', (data) => {
      console.log('[Socket] "wa_status" event:', data)
      // handle both shapes: true  OR  { connected: true }
      const connected = data === true || data?.connected === true
      setWaConnected(connected)
      if (connected) setQrCode(null)
    })

    s.on('new_message', (data) => {
      console.log('[Socket] "new_message" event:', data)
      setNewMessages(prev => [...prev.slice(-99), data])
    })

    return () => {
      console.log('[Socket] Tearing down connection')
      s.disconnect()
    }
  }, [])

  const clearNewMessages = () => setNewMessages([])

  return (
    <SocketContext.Provider value={{
      socket,
      socketConnected,
      socketError,
      waConnected,
      qrCode,
      setQrCode,
      newMessages,
      clearNewMessages,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

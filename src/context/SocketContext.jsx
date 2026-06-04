import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

// Direct backend URL — the browser connects here directly.
// The backend must allow this frontend's origin in its CORS config.
const BACKEND_URL = 'https://cd40e092-62bf-4c10-84d7-6b0ac1f7b021-00-3sh1199zv3jqi.sisko.replit.dev'

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
      // polling first — more reliable through proxies/firewalls
      transports: ['polling', 'websocket'],
      withCredentials: false,
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
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
      console.error('[Socket] connect_error:', err.message, err)
      setSocketConnected(false)
      setSocketError(err.message)
    })

    s.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected — reason:', reason)
      setSocketConnected(false)
    })

    s.io.on('reconnect_attempt', (n) => {
      console.log(`[Socket] Reconnect attempt #${n}`)
    })

    s.io.on('reconnect', (n) => {
      console.log(`[Socket] Reconnected after ${n} attempt(s)`)
    })

    s.on('qr', (data) => {
      console.log('[Socket] "qr" event received')
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

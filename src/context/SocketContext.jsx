import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const BACKEND_URL = 'https://cd40e092-62bf-4c10-84d7-6b0ac1f7b021-00-3sh1199zv3jqi.sisko.replit.dev'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [waConnected, setWaConnected] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [newMessages, setNewMessages] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    const s = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('qr', (data) => {
      setQrCode(data)
      setWaConnected(false)
    })

    s.on('wa_status', (data) => {
      setWaConnected(data?.connected === true)
      if (data?.connected) setQrCode(null)
    })

    s.on('new_message', (data) => {
      setNewMessages(prev => [...prev.slice(-99), data])
    })

    return () => {
      s.disconnect()
    }
  }, [])

  const clearNewMessages = () => setNewMessages([])

  return (
    <SocketContext.Provider value={{ socket, waConnected, qrCode, setQrCode, newMessages, clearNewMessages }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

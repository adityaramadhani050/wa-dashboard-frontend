import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import QRSetupPage from './pages/QRSetupPage'
import InboxPage from './pages/InboxPage'
import ChatPage from './pages/ChatPage'
import AnalyticsPage from './pages/AnalyticsPage'

function ProtectedLayout({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <SocketProvider>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">{children}</div>
      </div>
    </SocketProvider>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/inbox" replace /> : <LoginPage />} />
      <Route path="/qr" element={<ProtectedLayout><QRSetupPage /></ProtectedLayout>} />
      <Route path="/inbox" element={<ProtectedLayout><InboxPage /></ProtectedLayout>} />
      <Route path="/chat/:id" element={<ProtectedLayout><ChatPage /></ProtectedLayout>} />
      <Route path="/analytics" element={<ProtectedLayout><AnalyticsPage /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to={user ? '/inbox' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

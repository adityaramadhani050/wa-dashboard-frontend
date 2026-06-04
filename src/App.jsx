import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import QRSetupPage from './pages/QRSetupPage'
import InboxPage from './pages/InboxPage'
import ChatPage from './pages/ChatPage'
import AnalyticsPage from './pages/AnalyticsPage'

// Single persistent shell — SocketProvider mounts once here,
// never torn down by route changes
function ProtectedShell() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <SocketProvider>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Outlet />
        </div>
      </div>
    </SocketProvider>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/inbox" replace /> : <LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/qr"        element={<QRSetupPage />} />
        <Route path="/inbox"     element={<InboxPage />} />
        <Route path="/chat/:id"  element={<ChatPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
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

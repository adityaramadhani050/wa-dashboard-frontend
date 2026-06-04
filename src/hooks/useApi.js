import axios from 'axios'

// Direct backend URL — the browser calls this directly.
// The backend must return CORS headers allowing this frontend's origin.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  withCredentials: false,
})

export const getConversations = () => api.get('/conversations').then(r => r.data)
export const getMessages = (id) => api.get(`/conversations/${id}/messages`).then(r => r.data)
export const sendMessage = (id, message) => api.post(`/conversations/${id}/messages`, { message }).then(r => r.data)
export const assignAgent = (id, agent_id) => api.post(`/conversations/${id}/assign`, { agent_id }).then(r => r.data)
export const updateStatus = (id, status) => api.patch(`/conversations/${id}/status`, { status }).then(r => r.data)
export const getDailyStats = () => api.get('/stats/daily').then(r => r.data)
export const getAgentStats = () => api.get('/stats/agents').then(r => r.data)
export const getAgents = () => api.get('/agents').then(r => r.data)

export default api
export const resetWASession = () => api.post('/wa/reset').then(r => r.data)

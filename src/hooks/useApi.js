import axios from 'axios'

const BASE = 'https://cd40e092-62bf-4c10-84d7-6b0ac1f7b021-00-3sh1199zv3jqi.sisko.replit.dev'

const api = axios.create({ baseURL: BASE, timeout: 10000 })

export const getConversations = () => api.get('/api/conversations').then(r => r.data)
export const getMessages = (id) => api.get(`/api/conversations/${id}/messages`).then(r => r.data)
export const sendMessage = (id, message) => api.post(`/api/conversations/${id}/messages`, { message }).then(r => r.data)
export const assignAgent = (id, agent_id) => api.post(`/api/conversations/${id}/assign`, { agent_id }).then(r => r.data)
export const updateStatus = (id, status) => api.patch(`/api/conversations/${id}/status`, { status }).then(r => r.data)
export const getDailyStats = () => api.get('/api/stats/daily').then(r => r.data)
export const getAgentStats = () => api.get('/api/stats/agents').then(r => r.data)

export default api

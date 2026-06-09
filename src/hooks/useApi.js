import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  withCredentials: false,
})

export const getConversations = (agentId) =>
  api.get('/conversations', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const getMessages = (id) => api.get(`/conversations/${id}/messages`).then(r => r.data)
export const sendMessage = (id, message) => api.post(`/conversations/${id}/messages`, { message }).then(r => r.data)
export const sendMedia = (conversationId, file, caption) => {
  const form = new FormData()
  form.append('file', file)
  form.append('conversation_id', String(conversationId))
  if (caption) form.append('caption', caption)
  return api.post('/messages/send-media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then(r => r.data)
}
export const assignAgent = (id, agent_id) => api.post(`/conversations/${id}/assign`, { agent_id }).then(r => r.data)
export const updateStatus = (id, status) => api.patch(`/conversations/${id}/status`, { status }).then(r => r.data)
export const deleteConversation = (id) => api.delete(`/conversations/${id}`).then(r => r.data)
export const deleteMessage = (id) => api.delete(`/messages/${id}`).then(r => r.data)
export const editMessage = (id, body) => api.patch(`/messages/${id}`, { body }).then(r => r.data)
export const getDailyStats = (from, to) => api.get('/stats/daily', { params: { from, to } }).then(r => r.data)
export const getAgentStats = () => api.get('/stats/agents').then(r => r.data)
export const getContactStats = () => api.get('/stats/contacts').then(r => r.data)
export const getAgents = () => api.get('/agents').then(r => r.data)
export const createAgent = (payload) => api.post('/agents', payload).then(r => r.data)
export const updateAgent = (id, payload) => api.put(`/agents/${id}`, payload).then(r => r.data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`).then(r => r.data)
export const resetWASession = () => api.post('/wa/reset').then(r => r.data)

export default api

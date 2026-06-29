import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  withCredentials: false,
})

// Sertakan token JWT di setiap request bila tersedia
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Bila token tidak valid/kedaluwarsa (401), bersihkan sesi & arahkan ke login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('wa_user')
      localStorage.removeItem('wa_token')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(err)
  }
)

export const getConversations = (agentId) =>
  api.get('/conversations', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const getConversation = (id) => api.get(`/conversations/${id}`).then(r => r.data)
export const getMessages = (id) => api.get(`/conversations/${id}/messages`).then(r => r.data)
export const sendMessage = (id, message, replyTo) => api.post(`/conversations/${id}/messages`, { message, reply_to: replyTo || undefined }).then(r => r.data)
export const sendMedia = (conversationId, file, caption, replyTo) => {
  const form = new FormData()
  form.append('file', file)
  form.append('conversation_id', String(conversationId))
  if (caption) form.append('caption', caption)
  if (replyTo) form.append('reply_to', JSON.stringify(replyTo))
  return api.post('/messages/send-media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then(r => r.data)
}
export const assignAgent = (id, agent_id) => api.post(`/conversations/${id}/assign`, { agent_id }).then(r => r.data)
export const unassignAgent = (id) => api.post(`/conversations/${id}/unassign`).then(r => r.data)
export const updateStatus = (id, status) => api.patch(`/conversations/${id}/status`, { status }).then(r => r.data)
export const deleteConversation = (id) => api.delete(`/conversations/${id}`).then(r => r.data)
export const getContacts = (agentId) =>
  api.get('/contacts', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const updateContact = (id, payload) => api.patch(`/contacts/${id}`, payload).then(r => r.data)
export const getDailyStats = (from, to) => api.get('/stats/daily', { params: { from, to } }).then(r => r.data)
export const getAgentStats = () => api.get('/stats/agents').then(r => r.data)
export const getContactStats = () => api.get('/stats/contacts').then(r => r.data)
export const getResponseKpi = (from, to) => api.get('/stats/response-kpi', { params: { from, to } }).then(r => r.data)
export const getFunnel = (from, to) => api.get('/stats/funnel', { params: { from, to } }).then(r => r.data)
export const getAgents = () => api.get('/agents').then(r => r.data)
export const createAgent = (payload) => api.post('/agents', payload).then(r => r.data)
export const updateAgent = (id, payload) => api.put(`/agents/${id}`, payload).then(r => r.data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`).then(r => r.data)
export const resetWASession = () => api.post('/wa/reset').then(r => r.data)
export const syncMessages = () => api.post('/wa/sync').then(r => r.data)

// Template Pesan / Quick Reply
export const getTemplates = () => api.get('/templates').then(r => r.data)
export const createTemplate = (payload) => api.post('/templates', payload).then(r => r.data)
export const updateTemplate = (id, payload) => api.put(`/templates/${id}`, payload).then(r => r.data)
export const deleteTemplate = (id) => api.delete(`/templates/${id}`).then(r => r.data)
export const getTopTemplates = (limit) => api.get('/templates/top', limit ? { params: { limit } } : {}).then(r => r.data)
export const useTemplate = (id) => api.post(`/templates/${id}/use`).then(r => r.data)

// Katalog Produk (knowledge base AI)
export const getProducts = () => api.get('/products').then(r => r.data)
export const createProduct = (payload) => api.post('/products', payload).then(r => r.data)
export const updateProduct = (id, payload) => api.put(`/products/${id}`, payload).then(r => r.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`).then(r => r.data)

// Galeri Produk / Quick Media
export const getQuickMedia = () => api.get('/messages/quick-media').then(r => r.data)
export const uploadQuickMedia = (file, label, category) => {
  const form = new FormData()
  form.append('file', file)
  form.append('label', label)
  if (category) form.append('category', category)
  return api.post('/messages/quick-media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then(r => r.data)
}
export const deleteQuickMedia = (id) => api.delete(`/messages/quick-media/${id}`).then(r => r.data)
export const sendQuickMedia = (conversationId, quickMediaId, caption, replyTo) =>
  api.post('/messages/send-quick-media', {
    conversation_id: conversationId,
    quick_media_id: quickMediaId,
    caption,
    reply_to: replyTo || undefined,
  }).then(r => r.data)

// Catatan Kontak (Contact Notes)
export const getContactNotes = (contactId) => api.get(`/contacts/${contactId}/notes`).then(r => r.data)
export const createContactNote = (contactId, payload) => api.post(`/contacts/${contactId}/notes`, payload).then(r => r.data)
export const getContactConversations = (contactId) => api.get(`/contacts/${contactId}/conversations`).then(r => r.data)

// Tag Percakapan (Conversation Tags)
export const getTags = () => api.get('/tags').then(r => r.data)
export const createTag = (payload) => api.post('/tags', payload).then(r => r.data)
export const updateTag = (id, payload) => api.put(`/tags/${id}`, payload).then(r => r.data)
export const deleteTag = (id) => api.delete(`/tags/${id}`).then(r => r.data)
export const addTagToConversation = (conversationId, tagId) => api.post(`/conversations/${conversationId}/tags`, { tag_id: tagId }).then(r => r.data)
export const removeTagFromConversation = (conversationId, tagId) => api.delete(`/conversations/${conversationId}/tags/${tagId}`).then(r => r.data)

// Pengingat Follow-up (Reminders)
export const createReminder = (payload) => api.post('/reminders', payload).then(r => r.data)
export const getDueReminders = () => api.get('/reminders/due').then(r => r.data)
export const markReminderDone = (id) => api.patch(`/reminders/${id}`, { done: true }).then(r => r.data)

// Saran Balasan AI
export const generateAiSuggestion = (conversationId) =>
  api.post('/ai/suggest', { conversation_id: conversationId }, { timeout: 30000 }).then(r => r.data)
export const suggestAiTags = (conversationId) =>
  api.post('/ai/suggest-tags', { conversation_id: conversationId }, { timeout: 30000 }).then(r => r.data)
export const suggestAiNote = (conversationId) =>
  api.post('/ai/suggest-note', { conversation_id: conversationId }, { timeout: 30000 }).then(r => r.data)

// Auto-assign chat (round-robin / least-loaded)
export const getAutoAssign = () => api.get('/settings/auto-assign').then(r => r.data)
export const setAutoAssign = (enabled) => api.put('/settings/auto-assign', { enabled }).then(r => r.data)

// VAPID public key untuk web push (endpoint terbuka)
export const getVapidPublicKey = () => api.get('/push/vapid-public-key').then(r => r.data)

// Device token untuk push notification (mobile)
export const registerDevice = (token, platform = 'android') =>
  api.post('/devices', { token, platform }).then(r => r.data)
export const unregisterDevice = (token) =>
  api.delete(`/devices/${encodeURIComponent(token)}`).then(r => r.data)

export default api

import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wa-dashboard-backend-production.up.railway.app'

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
  withCredentials: false,
})

export const getConversations = (agentId) =>
  api.get('/conversations', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const getConversation = (id) => api.get(`/conversations/${id}`).then(r => r.data)
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
export const getContacts = (agentId) =>
  api.get('/contacts', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const updateContact = (id, payload) => api.patch(`/contacts/${id}`, payload).then(r => r.data)
export const getDailyStats = (from, to) => api.get('/stats/daily', { params: { from, to } }).then(r => r.data)
export const getAgentStats = () => api.get('/stats/agents').then(r => r.data)
export const getContactStats = () => api.get('/stats/contacts').then(r => r.data)
export const getAgents = () => api.get('/agents').then(r => r.data)
export const createAgent = (payload) => api.post('/agents', payload).then(r => r.data)
export const updateAgent = (id, payload) => api.put(`/agents/${id}`, payload).then(r => r.data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`).then(r => r.data)
export const resetWASession = () => api.post('/wa/reset').then(r => r.data)

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
export const sendQuickMedia = (conversationId, quickMediaId, caption) =>
  api.post('/messages/send-quick-media', {
    conversation_id: conversationId,
    quick_media_id: quickMediaId,
    caption,
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

export default api

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
export const getMessages = (id, params) => api.get(`/conversations/${id}/messages`, params ? { params } : {}).then(r => r.data)
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
// Kirim lokasi & kontak
export const sendLocation = (conversationId, { latitude, longitude, name, address }) =>
  api.post('/messages/send-location', { conversation_id: conversationId, latitude, longitude, name, address }).then(r => r.data)
export const sendContact = (conversationId, { name, phone }) =>
  api.post('/messages/send-contact', { conversation_id: conversationId, name, phone }).then(r => r.data)
export const assignAgent = (id, agent_id) => api.post(`/conversations/${id}/assign`, { agent_id }).then(r => r.data)
export const resumeAiChat = (id) => api.post(`/conversations/${id}/ai-resume`).then(r => r.data)
export const unassignAgent = (id) => api.post(`/conversations/${id}/unassign`).then(r => r.data)
export const updateStatus = (id, status) => api.patch(`/conversations/${id}/status`, { status }).then(r => r.data)
// Regional chat (admin): 'barat' | 'timur' -> diarahkan ke agent regional tsb bila belum ada agent
export const setConversationRegion = (id, region) => api.patch(`/conversations/${id}/region`, { region }).then(r => r.data)
export const deleteConversation = (id) => api.delete(`/conversations/${id}`).then(r => r.data)
export const getContacts = (agentId) =>
  api.get('/contacts', agentId ? { params: { agent_id: agentId } } : {}).then(r => r.data)
export const updateContact = (id, payload) => api.patch(`/contacts/${id}`, payload).then(r => r.data)
// Ubah regional banyak kontak sekaligus (admin)
export const bulkSetContactRegion = (ids, region) =>
  api.post('/contacts/bulk-region', { ids, region: region || null }, { timeout: 60000 }).then(r => r.data)
export const getDailyStats = (from, to, region) => api.get('/stats/daily', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const getAgentStats = (from, to, region) => api.get('/stats/agents', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const getContactStats = (region) => api.get('/stats/contacts', { params: { region: region || undefined } }).then(r => r.data)
export const getAnalyticsSummary = (from, to, region) => api.get('/stats/summary', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const getResponseKpi = (from, to, region) => api.get('/stats/response-kpi', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const getFunnel = (from, to, region) => api.get('/stats/funnel', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const getAgents = () => api.get('/agents').then(r => r.data)
export const createAgent = (payload) => api.post('/agents', payload).then(r => r.data)
export const updateAgent = (id, payload) => api.put(`/agents/${id}`, payload).then(r => r.data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`).then(r => r.data)
// Ketersediaan agent (aktif/non-aktif untuk auto-assign)
export const setAgentAvailability = (id, available) => api.patch(`/agents/${id}/availability`, { available }).then(r => r.data)
export const setAgentRegion = (id, region) => api.patch(`/agents/${id}/region`, { region: region || null }).then(r => r.data)
export const getMyAvailability = () => api.get('/me/availability').then(r => r.data)
export const changeMyPassword = (current_password, new_password) => api.post('/me/password', { current_password, new_password }).then(r => r.data)
export const setMyAvailability = (available) => api.patch('/me/availability', { available }).then(r => r.data)
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
// Follow-up otomatis (menggantikan pengingat manual)
export const getFollowupTasks = (view, filters = {}) =>
  api.get('/followup/tasks', { params: { view, ...filters } }).then(r => r.data)
export const getFollowupDue = () => api.get('/followup/due').then(r => r.data)
export const getFollowupSummary = (filters = {}) => api.get('/followup/summary', { params: filters }).then(r => r.data)
export const getConversationResponseStats = (conversationId) => api.get(`/conversations/${conversationId}/response-stats`).then(r => r.data)
export const getConversationFollowup = (conversationId) => api.get(`/followup/conversation/${conversationId}`).then(r => r.data)
export const completeFollowupTask = (taskId, payload) => api.post(`/followup/tasks/${taskId}/complete`, payload).then(r => r.data)
export const getFollowupSettings = () => api.get('/followup/settings').then(r => r.data)
// payload: { templates?, alert?: { enabled, late_days } }
export const saveFollowupSettings = (payload) => api.put('/followup/settings', payload).then(r => r.data)
export const getFollowupReport = (from, to, region) =>
  api.get('/followup/report', { params: { from, to, region: region || undefined } }).then(r => r.data)
export const generateFollowupDraft = (conversationId, step) =>
  api.post('/ai/followup-draft', { conversation_id: conversationId, step }, { timeout: 30000 }).then(r => r.data)

// Saran Balasan AI
export const generateAiSuggestion = (conversationId) =>
  api.post('/ai/suggest', { conversation_id: conversationId }, { timeout: 30000 }).then(r => r.data)

// Token bot/service untuk integrasi mesin-ke-mesin (mis. WA Bot RenusPro)
export const generateBotToken = (name) => api.post('/auth/bot-token', name ? { name } : {}).then(r => r.data)

// Teruskan pesan ke percakapan lain
export const forwardMessage = (messageId, targetConversationId) =>
  api.post('/messages/forward', { message_id: messageId, target_conversation_id: targetConversationId }).then(r => r.data)

// Hapus pesan
export const deleteMessage = (messageId) => api.delete(`/messages/${messageId}`).then(r => r.data)

// Edit pesan (hanya pesan keluar, teks, <=15 menit)
export const editMessage = (messageId, message) => api.patch(`/messages/${messageId}/edit`, { message }).then(r => r.data)

// Auto-assign chat (dibagi rata berdasarkan kontak baru hari ini per agent)
export const getAutoAssign = () => api.get('/settings/auto-assign').then(r => r.data)
export const setAutoAssign = (enabled) => api.put('/settings/auto-assign', { enabled }).then(r => r.data)

// Jam & hari kerja (pengecualian overdue di luar jam kerja)
export const getWorkHours = () => api.get('/settings/work-hours').then(r => r.data)
export const setWorkHours = (payload) => api.put('/settings/work-hours', payload).then(r => r.data)
// Routing regional (bot tanya lokasi -> agent Barat/Timur)
export const getAiSales = () => api.get('/settings/ai-sales').then(r => r.data)
export const saveAiSales = (payload) => api.put('/settings/ai-sales', payload).then(r => r.data)
// Pengetahuan AI Sales: skill/playbook, pelajaran (koreksi), memori customer
export const getAiSkills = () => api.get('/ai-sales/skills').then(r => r.data)
export const createAiSkill = (payload) => api.post('/ai-sales/skills', payload).then(r => r.data)
export const updateAiSkill = (id, payload) => api.put(`/ai-sales/skills/${id}`, payload).then(r => r.data)
export const deleteAiSkill = (id) => api.delete(`/ai-sales/skills/${id}`).then(r => r.data)
export const suggestAiSkillKeywords = (payload) => api.post('/ai-sales/skills/suggest-keywords', payload).then(r => r.data)
export const testAiSkills = (text) => api.post('/ai-sales/skills/test', { text }).then(r => r.data)
export const getAiLessons = () => api.get('/ai-sales/lessons').then(r => r.data)
export const createAiLesson = (payload) => api.post('/ai-sales/lessons', payload).then(r => r.data)
export const updateAiLesson = (id, payload) => api.put(`/ai-sales/lessons/${id}`, payload).then(r => r.data)
export const deleteAiLesson = (id) => api.delete(`/ai-sales/lessons/${id}`).then(r => r.data)
export const getAiModels = () => api.get('/settings/ai-models').then(r => r.data)
export const saveAiModels = (payload) => api.put('/settings/ai-models', payload).then(r => r.data)
export const getOpenRouterModels = () => api.get('/ai-sales/models').then(r => r.data)
export const getOpenRouterStatus = () => api.get('/ai-sales/openrouter').then(r => r.data)
export const testAiModel = (payload) => api.post('/ai-sales/models/test', payload).then(r => r.data)
export const getAiTeam = () => api.get('/settings/ai-team').then(r => r.data)
export const saveAiTeam = (payload) => api.put('/settings/ai-team', payload).then(r => r.data)
export const getTeamRequests = (params) => api.get('/ai-sales/team-requests', { params }).then(r => r.data)
export const closeTeamRequest = (id) => api.post(`/ai-sales/team-requests/${id}/close`).then(r => r.data)
export const checkTeamNumbers = () => api.post('/ai-sales/team-check').then(r => r.data)
export const getAiUsage = (days) => api.get('/ai-sales/usage', { params: { days } }).then(r => r.data)
export const getAiMemory = (contactId) => api.get(`/ai-sales/memory/${contactId}`).then(r => r.data)
export const saveAiMemory = (contactId, summary) => api.put(`/ai-sales/memory/${contactId}`, { summary }).then(r => r.data)
export const getRegionalRouting = () => api.get('/settings/regional-routing').then(r => r.data)
export const setRegionalRouting = (payload) => api.put('/settings/regional-routing', payload).then(r => r.data)
// Isi regional kontak lama dari regional agent yang menanganinya (sekali jalan)
export const backfillRegional = () => api.post('/settings/regional-backfill', {}, { timeout: 120000 }).then(r => r.data)
// Backfill hapus media lama (bebaskan storage)
export const cleanupMedia = (days) => api.post('/settings/cleanup-media', { days }, { timeout: 120000 }).then(r => r.data)

// Template Broadcast (pesan siap-pakai untuk campaign, teks + media opsional)
export const getBroadcastTemplates = () => api.get('/broadcast/templates').then(r => r.data)
export const createBroadcastTemplate = (name, body, file) => {
  const form = new FormData()
  form.append('name', name)
  form.append('body', body || '')
  if (file) form.append('file', file)
  return api.post('/broadcast/templates', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then(r => r.data)
}
export const updateBroadcastTemplate = (id, { name, body, file, removeMedia } = {}) => {
  const form = new FormData()
  if (name != null) form.append('name', name)
  if (body != null) form.append('body', body)
  if (file) form.append('file', file)
  if (removeMedia) form.append('remove_media', 'true')
  return api.put(`/broadcast/templates/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then(r => r.data)
}
export const deleteBroadcastTemplate = (id) => api.delete(`/broadcast/templates/${id}`).then(r => r.data)

// Broadcast Promo (kirim pesan promo ke calon customer belum deal)
export const getBroadcastCandidates = (cooldownDays) =>
  api.get('/broadcast/candidates', { params: { cooldown_days: cooldownDays || 14 } }).then(r => r.data)
export const getBroadcastCampaigns = () => api.get('/broadcast/campaigns').then(r => r.data)
export const getBroadcastCampaign = (id) => api.get(`/broadcast/campaigns/${id}`).then(r => r.data)
export const createBroadcastCampaign = (payload) => api.post('/broadcast/campaigns', payload, { timeout: 60000 }).then(r => r.data)
export const startBroadcastCampaign = (id) => api.post(`/broadcast/campaigns/${id}/start`).then(r => r.data)
export const pauseBroadcastCampaign = (id) => api.post(`/broadcast/campaigns/${id}/pause`).then(r => r.data)
export const cancelBroadcastCampaign = (id) => api.post(`/broadcast/campaigns/${id}/cancel`).then(r => r.data)
export const deleteBroadcastCampaign = (id) => api.delete(`/broadcast/campaigns/${id}`).then(r => r.data)

// VAPID public key untuk web push (endpoint terbuka)
export const getVapidPublicKey = () => api.get('/push/vapid-public-key').then(r => r.data)

// Device token untuk push notification (mobile)
export const registerDevice = (token, platform = 'android') =>
  api.post('/devices', { token, platform }).then(r => r.data)
export const unregisterDevice = (token) =>
  api.delete(`/devices/${encodeURIComponent(token)}`).then(r => r.data)

export default api

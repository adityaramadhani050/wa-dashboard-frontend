import { useState, useEffect, useCallback } from 'react'
import { getAgents, createAgent, updateAgent, deleteAgent, getAutoAssign, setAutoAssign, generateBotToken, getWorkHours, setWorkHours, setAgentAvailability, cleanupMedia, getRegionalRouting, setRegionalRouting, setAgentRegion, backfillRegional, getAiSales, saveAiSales } from '../hooks/useApi'
import { refreshAiAgent } from '../hooks/useAiAgent'
import AiKnowledgePanel from '../components/AiKnowledgePanel'
import AiUsagePanel from '../components/AiUsagePanel'
import AiModelsPanel from '../components/AiModelsPanel'
import AiTeamPanel from '../components/AiTeamPanel'
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Users, Shuffle, KeyRound, Copy, Check, Clock, HardDrive, MapPin, AlertTriangle, Settings2, Sparkles } from 'lucide-react'

const REGION_OPTIONS = [
  { value: '', label: '— Belum diatur' },
  { value: 'barat', label: 'Barat' },
  { value: 'timur', label: 'Timur' },
]

// Pesan bot yang bisa diubah admin (urut sesuai alur bot)
const BOT_MESSAGES = [
  { key: 'msg_ask', label: 'Pertanyaan lokasi', hint: 'Dikirim ke nomor baru. Variabel: {{nama}}' },
  { key: 'msg_retry', label: 'Tanya ulang', hint: 'Bila jawaban pertama tidak dikenali. Variabel: {{nama}}' },
  { key: 'msg_confirm', label: 'Konfirmasi regional (dengan agent)', hint: 'Lokasi terdeteksi & agent sudah ditugaskan. Variabel: {{nama}}, {{regional}}, {{agent}}' },
  { key: 'msg_confirm_queue', label: 'Konfirmasi regional (agent belum tersedia)', hint: 'Lokasi terdeteksi tapi semua agent regional itu sedang tidak tersedia. Variabel: {{nama}}, {{regional}}' },
  { key: 'msg_fail', label: 'Lokasi tidak terdeteksi', hint: 'Dikirim bila 2x jawaban tidak dikenali (tidak dikirim saat timeout). Variabel: {{nama}}' },
]

const WEEKDAYS = [
  { d: 1, label: 'Sen' }, { d: 2, label: 'Sel' }, { d: 3, label: 'Rab' },
  { d: 4, label: 'Kam' }, { d: 5, label: 'Jum' }, { d: 6, label: 'Sab' }, { d: 0, label: 'Min' },
]

const TABS = [
  { key: 'agents', label: 'Daftar Agent', icon: Users },
  { key: 'chat', label: 'Pembagian Chat', icon: Shuffle },
  { key: 'regional', label: 'Routing Regional', icon: MapPin },
  { key: 'ai', label: 'AI Sales', icon: Sparkles },
  { key: 'system', label: 'Sistem', icon: Settings2 },
]

const EMPTY_FORM = { name: '', username: '', email: '', role: 'agent', password: '', confirmPassword: '' }

const AVATAR_COLORS = ['var(--primary)','var(--success)','var(--warning)','#e05c8a','#7c5cd6','#2aaccc']
function avatarStyle(name) {
  const letter = (name || '?')[0].toUpperCase()
  const c = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  return { background: c + '22', color: c }
}

function Modal({ title, onClose, children }) {
  return (
    <div className="am-overlay" onClick={onClose}>
      <div className="am-modal" onClick={e => e.stopPropagation()}>
        <div className="am-modal-header">
          <h3>{title}</h3>
          <button className="am-close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AgentForm({ initial, onSave, onClose, loading, error, isEdit }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [showPw, setShowPw] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.username) return
    if (!isEdit && !form.password) return
    if (form.password && form.password !== form.confirmPassword) return
    onSave(form)
  }

  const pwMismatch = form.password && form.confirmPassword && form.password !== form.confirmPassword

  return (
    <form onSubmit={handleSubmit} className="am-form">
      <div className="am-field">
        <label>Nama Lengkap <span className="req">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nama lengkap" required />
      </div>
      <div className="am-field">
        <label>Username <span className="req">*</span></label>
        <input
          value={form.username}
          onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="contoh: johndoe"
          required
        />
        <span className="am-hint">Huruf kecil, tanpa spasi</span>
      </div>
      <div className="am-field">
        <label>Email <span style={{fontSize:11,color:'var(--muted)'}}>(opsional)</span></label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
      </div>
      <div className="am-field">
        <label>Role</label>
        <select value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="am-field">
        <label>{isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
        <div className="am-pw-wrap">
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder={isEdit ? 'Biarkan kosong jika tidak diubah' : 'Min. 6 karakter'}
            minLength={form.password ? 6 : undefined}
            required={!isEdit}
          />
          <button type="button" className="am-pw-eye" onClick={() => setShowPw(s => !s)}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      {form.password && (
        <div className="am-field">
          <label>Konfirmasi Password *</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={e => set('confirmPassword', e.target.value)}
            placeholder="Ulangi password"
            required
          />
          {pwMismatch && <span className="am-hint err">Password tidak cocok</span>}
        </div>
      )}
      {error && <div className="am-form-err">{error}</div>}
      <div className="am-form-actions">
        <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="am-btn primary" disabled={loading || pwMismatch}>
          {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Agent'}
        </button>
      </div>
    </form>
  )
}

export default function AgentManagementPage() {
  const [agents, setAgents] = useState([])
  // Tab aktif diingat selama sesi browser
  const [tab, setTabState] = useState(() => { try { return sessionStorage.getItem('am_tab') || 'agents' } catch { return 'agents' } })
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem('am_tab', t) } catch {} }
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [autoAssign, setAutoAssignState] = useState(false)
  const [autoAssignBusy, setAutoAssignBusy] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [botTokenBusy, setBotTokenBusy] = useState(false)
  const [botTokenCopied, setBotTokenCopied] = useState(false)
  const [botTokenError, setBotTokenError] = useState('')
  const [wh, setWh] = useState(null)
  const [whBusy, setWhBusy] = useState(false)
  const [whSaved, setWhSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setAgents(await getAgents()) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getAutoAssign().then(d => setAutoAssignState(!!d.enabled)).catch(() => {}) }, [])
  useEffect(() => { getWorkHours().then(setWh).catch(() => {}) }, [])

  // AI Sales Agent
  const [ai, setAi] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSaved, setAiSaved] = useState(false)
  useEffect(() => { getAiSales().then(setAi).catch(() => {}) }, [])
  const saveAi = async (patch = {}) => {
    const payload = { ...ai, ...patch }
    setAiBusy(true); setAiError('')
    try {
      const saved = await saveAiSales({
        enabled: payload.enabled, agent_id: payload.agent_id || null, persona_name: payload.persona_name, company: payload.company,
        style: payload.style, instructions: payload.instructions, reply_delay_sec: Number(payload.reply_delay_sec) || 10,
        followup_enabled: !!payload.followup_enabled,
        lowercase: payload.lowercase !== false,
      })
      setAi(saved)
      refreshAiAgent()
      setAiSaved(true); setTimeout(() => setAiSaved(false), 2000)
    } catch (e) {
      setAiError(e?.response?.data?.error || 'Gagal menyimpan pengaturan AI Sales')
    } finally { setAiBusy(false) }
  }
  const aiAgent = agents.find(a => String(a.id) === String(ai?.agent_id))
  const [aiSection, setAiSectionState] = useState(() => { try { return sessionStorage.getItem('am_ai_sec') || 'settings' } catch { return 'settings' } })
  const setAiSection = (v) => { setAiSectionState(v); try { sessionStorage.setItem('am_ai_sec', v) } catch {} }

  const handleSaveWorkHours = async () => {
    if (!wh || whBusy) return
    setWhBusy(true); setWhSaved(false)
    try {
      const saved = await setWorkHours(wh)
      setWh(saved)
      setWhSaved(true)
      setTimeout(() => setWhSaved(false), 2000)
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal menyimpan jam kerja')
    } finally { setWhBusy(false) }
  }

  const toggleWhDay = (d) => {
    setWh(prev => {
      const days = prev?.days || []
      return { ...prev, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }
    })
  }

  // Backfill hapus media lama (bebaskan storage)
  const [cleanDays, setCleanDays] = useState(60)
  const [cleanBusy, setCleanBusy] = useState(false)
  const [cleanResult, setCleanResult] = useState(null)
  const handleCleanupMedia = async () => {
    if (cleanBusy) return
    const days = Math.max(1, parseInt(cleanDays, 10) || 60)
    if (!window.confirm(`Hapus SEMUA media lebih lama dari ${days} hari? Pesan tetap ada, hanya file media (foto/video/dok) yang dihapus permanen dari storage.`)) return
    setCleanBusy(true); setCleanResult(null)
    try {
      const res = await cleanupMedia(days)
      setCleanResult(res?.deleted ?? 0)
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal membersihkan media')
    } finally { setCleanBusy(false) }
  }

  const handleToggleAutoAssign = async () => {
    if (autoAssignBusy) return
    const next = !autoAssign
    setAutoAssignBusy(true)
    try {
      const res = await setAutoAssign(next)
      setAutoAssignState(!!res.enabled)
      if (res.enabled) {
        alert(res.distributed > 0
          ? `Auto-assign aktif. ${res.distributed} percakapan belum ter-assign langsung dibagikan ke agent secara seimbang.`
          : 'Auto-assign aktif. Chat baru akan otomatis dibagi rata ke agent.')
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal mengubah auto-assign')
    } finally { setAutoAssignBusy(false) }
  }

  const [availBusy, setAvailBusy] = useState(null)
  const handleToggleAvailability = async (agent) => {
    if (availBusy) return
    const next = agent.available === false // saat ini non-aktif -> aktifkan
    setAvailBusy(agent.id)
    try {
      await setAgentAvailability(agent.id, next)
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, available: next } : a))
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal mengubah ketersediaan agent')
    } finally { setAvailBusy(null) }
  }

  // ── Regional agent ────────────────────────────────────────────────────────
  const [regionBusy, setRegionBusy] = useState(null)
  const handleChangeAgentRegion = async (agent, region) => {
    if (regionBusy) return
    setRegionBusy(agent.id)
    try {
      await setAgentRegion(agent.id, region)
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, region: region || null } : a))
      getRegionalRouting().then(d => setRr(prev => prev ? { ...prev, status: d.status } : prev)).catch(() => {})
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal mengubah regional agent. Pastikan SQL migrasi regional sudah dijalankan.')
    } finally { setRegionBusy(null) }
  }

  // ── Routing regional (bot tanya lokasi) ──────────────────────────────────
  const [rr, setRr] = useState(null)
  const [rrBusy, setRrBusy] = useState(false)
  const [rrSaved, setRrSaved] = useState(false)
  const [rrError, setRrError] = useState('')
  const toRrState = (d) => ({ ...d, internal_numbers: (d.internal_numbers || []).join('\n') })
  useEffect(() => { getRegionalRouting().then(d => setRr(toRrState(d))).catch(() => {}) }, [])

  const saveRegional = async (patch = {}) => {
    if (!rr || rrBusy) return
    setRrBusy(true); setRrError(''); setRrSaved(false)
    try {
      const next = { ...rr, ...patch }
      const d = await setRegionalRouting({
        enabled: next.enabled,
        timeout_minutes: next.timeout_minutes,
        internal_numbers: next.internal_numbers,
        msg_ask: next.msg_ask, msg_retry: next.msg_retry, msg_confirm: next.msg_confirm,
        msg_confirm_queue: next.msg_confirm_queue, msg_fail: next.msg_fail,
      })
      setRr(toRrState(d))
      setRrSaved(true); setTimeout(() => setRrSaved(false), 2000)
    } catch (e) {
      setRrError(e?.response?.data?.error || 'Gagal menyimpan pengaturan routing regional')
    } finally { setRrBusy(false) }
  }

  const [backfillBusy, setBackfillBusy] = useState(false)
  const [backfillResult, setBackfillResult] = useState(null)
  const handleBackfill = async () => {
    if (backfillBusy) return
    if (!window.confirm('Isi regional kontak lama berdasarkan regional agent yang menanganinya? Kontak yang sudah punya regional tidak diubah.')) return
    setBackfillBusy(true); setBackfillResult(null)
    try { setBackfillResult(await backfillRegional()) }
    catch (e) { alert(e?.response?.data?.error || 'Gagal mengisi regional kontak lama') }
    finally { setBackfillBusy(false) }
  }

  const handleGenerateBotToken = async () => {
    if (botTokenBusy) return
    setBotTokenBusy(true); setBotTokenError(''); setBotTokenCopied(false)
    try {
      const res = await generateBotToken('Bot Notif WA')
      setBotToken(res.token || '')
    } catch (e) {
      setBotTokenError(e?.response?.data?.error || 'Gagal membuat token bot')
    } finally { setBotTokenBusy(false) }
  }

  const handleCopyBotToken = async () => {
    if (!botToken) return
    try {
      await navigator.clipboard.writeText(botToken)
      setBotTokenCopied(true)
      setTimeout(() => setBotTokenCopied(false), 2000)
    } catch {
      setBotTokenError('Gagal menyalin. Salin manual dari kotak di atas.')
    }
  }

  const handleCreate = async (form) => {
    setSaving(true); setFormError('')
    try {
      const agent = await createAgent({
        name: form.name,
        username: form.username,
        email: form.email || undefined,
        role: form.role,
        password: form.password,
      })
      setAgents(prev => [agent, ...prev])
      setModal(null)
    } catch (e) { setFormError(e.response?.data?.error || 'Gagal membuat agent') }
    finally { setSaving(false) }
  }

  const handleUpdate = async (form) => {
    setSaving(true); setFormError('')
    try {
      const payload = { name: form.name, username: form.username, email: form.email, role: form.role }
      if (form.password) payload.password = form.password
      const updated = await updateAgent(modal.agent.id, payload)
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a))
      setModal(null)
    } catch (e) { setFormError(e.response?.data?.error || 'Gagal mengupdate agent') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteAgent(deleteTarget.id)
      setAgents(prev => prev.filter(a => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) { setDeleteError(e.response?.data?.error || 'Gagal menghapus agent') }
    finally { setDeleting(false) }
  }

  const roleBadge = (role) => (
    <span className={`am-role ${role}`}>{role === 'admin' ? 'Admin' : 'Agent'}</span>
  )

  return (
    <div className="am-page">
      <div className="am-header">
        <h1><Users size={21} />Manajemen Agent{!loading && <span className="am-count">{agents.length}</span>}</h1>
        <button className="am-btn primary" onClick={() => { setFormError(''); setTab('agents'); setModal('create') }}>
          <Plus size={16} /><span className="am-hide-xs">Tambah Agent</span>
        </button>
      </div>

      <div className="am-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`am-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /><span>{t.label}</span>
            {t.key === 'regional' && rr?.status?.agents_without_region?.length > 0 && <span className="am-tab-dot" title="Ada agent tanpa regional" />}
          </button>
        ))}
      </div>

      {tab === 'agents' && (
        <>
          <div className="am-table-box">
        {loading ? (
          <div className="am-loading">
            {[...Array(4)].map((_, i) => <div key={i} className="am-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="am-empty">
            <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p>Belum ada agent. Klik "Tambah Agent" untuk membuat.</p>
          </div>
        ) : (
          <div className="am-table-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Regional</th>
                  <th>Ketersediaan</th>
                  <th>Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div className="am-agent-cell">
                        <div className="am-avatar" style={avatarStyle(a.name)}>{(a.name || 'A')[0].toUpperCase()}</div>
                        <span>{a.name}</span>
                        {ai?.enabled && String(ai.agent_id) === String(a.id) && <span className="ai-badge" title="Dikendalikan AI Sales"><Sparkles size={10} />AI</span>}
                      </div>
                    </td>
                    <td><span className="am-username">@{a.username || '—'}</span></td>
                    <td className="am-email">{a.email || <span style={{color:'var(--muted)'}}>-</span>}</td>
                    <td>{roleBadge(a.role)}</td>
                    <td>
                      {a.role === 'agent' ? (
                        <select
                          className={`am-region-select${a.region ? ` ${a.region}` : ' none'}`}
                          value={a.region || ''}
                          disabled={regionBusy === a.id}
                          onChange={e => handleChangeAgentRegion(a, e.target.value)}
                        >
                          {REGION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      {a.role === 'agent' ? (
                        <div className="am-avail">
                          <button
                            className={`aa-switch sm${a.available !== false ? ' on' : ''}`}
                            onClick={() => handleToggleAvailability(a)}
                            disabled={availBusy === a.id}
                            role="switch"
                            aria-checked={a.available !== false}
                            title={a.available !== false ? 'Aktif — ikut auto-assign' : 'Non-aktif — dilewati auto-assign'}
                          ><span className="aa-knob" /></button>
                          <span className={`am-avail-label${a.available !== false ? ' on' : ''}`}>
                            {a.available !== false ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </div>
                      ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="am-date">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <div className="am-actions">
                        <button
                          className="am-icon-btn edit"
                          onClick={() => { setFormError(''); setModal({ agent: a }) }}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="am-icon-btn del"
                          onClick={() => { setDeleteError(''); setDeleteTarget(a) }}
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {!loading && agents.length > 0 && (
        <div className="am-card-list">
          {agents.map(a => (
            <div key={a.id} className="am-card">
              <div className="am-card-top">
                <div className="am-avatar" style={avatarStyle(a.name)}>{(a.name || 'A')[0].toUpperCase()}</div>
                <div className="am-card-id">
                  <span className="am-card-name">{a.name}{ai?.enabled && String(ai.agent_id) === String(a.id) && <span className="ai-badge"><Sparkles size={10} />AI</span>}</span>
                  <span className="am-card-sub">@{a.username || '—'} · {roleBadge(a.role)}</span>
                </div>
                <div className="am-actions">
                  <button className="am-icon-btn edit" onClick={() => { setFormError(''); setModal({ agent: a }) }} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="am-icon-btn del" onClick={() => { setDeleteError(''); setDeleteTarget(a) }} aria-label="Hapus"><Trash2 size={15} /></button>
                </div>
              </div>
              {a.role === 'agent' && (
                <div className="am-card-ctrl">
                  <select
                    className={`am-region-select${a.region ? ` ${a.region}` : ' none'}`}
                    value={a.region || ''}
                    disabled={regionBusy === a.id}
                    onChange={e => handleChangeAgentRegion(a, e.target.value)}
                  >
                    {REGION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="am-avail">
                    <button className={`aa-switch sm${a.available !== false ? ' on' : ''}`} onClick={() => handleToggleAvailability(a)} disabled={availBusy === a.id} role="switch" aria-checked={a.available !== false}><span className="aa-knob" /></button>
                    <span className={`am-avail-label${a.available !== false ? ' on' : ''}`}>{a.available !== false ? 'Aktif' : 'Non-aktif'}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {tab === 'chat' && (
        <div className="aa-grid">
      <div className="aa-card">
        <div className="aa-info">
          <div className="aa-icon"><Shuffle size={18} /></div>
          <div>
            <div className="aa-title">Auto-assign Chat (Round-robin)</div>
            <div className="aa-desc">Bagi chat masuk ke agent secara seimbang berdasarkan jumlah kontak baru yang sudah diterima tiap agent hari ini (bukan chat aktif, karena chat aktif bisa berasal dari follow-up customer lama). Bila sama, agent dengan chat aktif lebih sedikit didahulukan. Saat diaktifkan, chat yang belum ter-assign langsung dibagikan.</div>
          </div>
        </div>
        <button
          className={`aa-switch${autoAssign ? ' on' : ''}`}
          onClick={handleToggleAutoAssign}
          disabled={autoAssignBusy}
          role="switch"
          aria-checked={autoAssign}
          title={autoAssign ? 'Nonaktifkan' : 'Aktifkan'}
        >
          <span className="aa-knob" />
        </button>
      </div>

      <div className="aa-card wh-card">
        <div className="aa-info">
          <div className="aa-icon"><Clock size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="aa-title">Jam & Hari Kerja (Overdue)</div>
            <div className="aa-desc">Bila aktif, indikator overdue tidak dihitung di luar jam/hari kerja. Zona waktu WIB.</div>
            {wh && (
              <div className="wh-body">
                <label className="wh-enable">
                  <input type="checkbox" checked={!!wh.enabled} onChange={e => setWh({ ...wh, enabled: e.target.checked })} />
                  <span>Aktifkan batasan jam kerja</span>
                </label>
                <div className={`wh-controls${wh.enabled ? '' : ' disabled'}`}>
                  <div className="wh-days">
                    {WEEKDAYS.map(w => (
                      <button
                        key={w.d}
                        type="button"
                        className={`wh-day${(wh.days || []).includes(w.d) ? ' on' : ''}`}
                        onClick={() => wh.enabled && toggleWhDay(w.d)}
                        disabled={!wh.enabled}
                      >{w.label}</button>
                    ))}
                  </div>
                  <div className="wh-times">
                    <label>Dari <input type="time" value={wh.start || '08:00'} disabled={!wh.enabled} onChange={e => setWh({ ...wh, start: e.target.value })} /></label>
                    <label>Sampai <input type="time" value={wh.end || '17:00'} disabled={!wh.enabled} onChange={e => setWh({ ...wh, end: e.target.value })} /></label>
                  </div>
                </div>
                <button className="am-btn primary wh-save" onClick={handleSaveWorkHours} disabled={whBusy}>
                  {whSaved ? <><Check size={15} /> Tersimpan</> : whBusy ? 'Menyimpan...' : 'Simpan Jam Kerja'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

        </div>
      )}

      {tab === 'regional' && (
        <div className="aa-grid">
      <div className="aa-card rr-card">
        <div className="aa-info">
          <div className="aa-icon"><MapPin size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rr-head">
              <div>
                <div className="aa-title">Routing Regional (Barat / Timur)</div>
                <div className="aa-desc">Bot menanyakan kota customer baru, lalu chat diarahkan ke agent regional yang sesuai. Customer lama kembali ke agent terakhirnya.</div>
              </div>
              {rr && (
                <button
                  className={`aa-switch${rr.enabled ? ' on' : ''}`}
                  onClick={() => saveRegional({ enabled: !rr.enabled })}
                  disabled={rrBusy || rr.status?.migrated === false}
                  role="switch"
                  aria-checked={!!rr.enabled}
                  title={rr.enabled ? 'Nonaktifkan routing regional' : 'Aktifkan routing regional'}
                ><span className="aa-knob" /></button>
              )}
            </div>

            {rr && (
              <div className="rr-body">
                <div className="rr-status">
                  <span className="rr-chip barat">Barat: {rr.status?.per_region?.barat ?? 0} agent tersedia</span>
                  <span className="rr-chip timur">Timur: {rr.status?.per_region?.timur ?? 0} agent tersedia</span>
                </div>
                {rr.status?.migrated === false && (
                  <div className="rr-warn"><AlertTriangle size={14} /> Kolom database regional belum ada. Jalankan SQL migrasi regional di Supabase terlebih dahulu.</div>
                )}
                {rr.status?.agents_without_region?.length > 0 && (
                  <div className="rr-warn"><AlertTriangle size={14} /> Agent belum diberi regional (tidak akan menerima lead baru): {rr.status.agents_without_region.join(', ')}</div>
                )}
                {rr.enabled && !autoAssign && (
                  <div className="rr-warn"><AlertTriangle size={14} /> Auto-assign sedang mati: bot tetap bertanya & menyimpan regional, tetapi chat tidak dibagikan otomatis.</div>
                )}

                <div className="rr-grid">
                  <label className="rr-field">
                    <span>Batas waktu menunggu jawaban (menit)</span>
                    <input type="number" min="0" max="1440" value={rr.timeout_minutes}
                      onChange={e => setRr({ ...rr, timeout_minutes: e.target.value })} />
                    <small>Tidak dijawab dalam waktu ini → masuk antrian admin tanpa pesan ke customer. Isi 0 untuk menonaktifkan.</small>
                  </label>
                  <label className="rr-field">
                    <span>Nomor internal (tidak ditanya bot)</span>
                    <textarea rows={3} value={rr.internal_numbers}
                      placeholder={'Satu nomor per baris, mis.\n081234567890'}
                      onChange={e => setRr({ ...rr, internal_numbers: e.target.value })} />
                    <small>Staf, teknisi, penerima notifikasi RenusPro. Grup WA otomatis dikecualikan.</small>
                  </label>
                </div>

                <div className="rr-msgs">
                  {BOT_MESSAGES.map(m => (
                    <label key={m.key} className="rr-field">
                      <span>{m.label}</span>
                      <textarea rows={3} value={rr[m.key] || ''} onChange={e => setRr({ ...rr, [m.key]: e.target.value })} />
                      <small>{m.hint}</small>
                    </label>
                  ))}
                </div>

                {rrError && <div className="am-form-err">{rrError}</div>}
                <div className="rr-actions">
                  <button className="am-btn primary" onClick={() => saveRegional()} disabled={rrBusy}>
                    {rrSaved ? <><Check size={15} /> Tersimpan</> : rrBusy ? 'Menyimpan...' : 'Simpan Pengaturan Regional'}
                  </button>
                  <button className="am-btn secondary" onClick={handleBackfill} disabled={backfillBusy || rr.status?.migrated === false}
                    title="Isi regional kontak lama dari regional agent yang menanganinya (sekali jalan)">
                    <MapPin size={15} /> {backfillBusy ? 'Mengisi...' : 'Isi Regional Kontak Lama'}
                  </button>
                  {backfillResult && (
                    <span className="cm-result">
                      <Check size={14} /> {backfillResult.contacts_updated} kontak & {backfillResult.conversations_updated} chat terisi
                      {backfillResult.without_source > 0 ? ` · ${backfillResult.without_source} chat belum bisa ditentukan (atur di menu Kontak)` : ''}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="ai-subnav" role="tablist">
          {[['settings', 'Pengaturan'], ['models', 'Model AI'], ['team', 'Tanya Tim'], ['skills', 'Skill / Playbook'], ['lessons', 'Koreksi'], ['usage', 'Pemakaian']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={aiSection === k} className={aiSection === k ? 'active' : ''} onClick={() => setAiSection(k)}>{label}</button>
          ))}
        </div>
      )}
      {tab === 'ai' && (aiSection === 'skills' || aiSection === 'lessons') && <AiKnowledgePanel section={aiSection} />}
      {tab === 'ai' && aiSection === 'usage' && <><AiKnowledgePanel section="none" /><AiUsagePanel /></>}
      {tab === 'ai' && aiSection === 'models' && <><AiKnowledgePanel section="none" /><AiModelsPanel /></>}
      {tab === 'ai' && aiSection === 'team' && <><AiKnowledgePanel section="none" /><AiTeamPanel /></>}
      {tab === 'ai' && aiSection === 'settings' && (
        <div className="aa-grid">
          <div className="aa-card rr-card">
            <div className="aa-info">
              <div className="aa-icon"><Sparkles size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rr-head">
                  <div>
                    <div className="aa-title">AI Sales Agent</div>
                    <div className="aa-desc">Akun agent yang dikendalikan AI: ikut auto-assign, membalas customer otomatis layaknya sales (menggali kebutuhan, penawaran dari Katalog Produk, sampai mengumpulkan data & usulan jadwal survei). Konfirmasi survei & Deal tetap oleh admin. Ambil alih chat kapan saja dengan meng-assign ke agent lain.</div>
                  </div>
                  {ai && (
                    <button className={`aa-switch${ai.enabled ? ' on' : ''}`} onClick={() => saveAi({ enabled: !ai.enabled })}
                      disabled={aiBusy || (!ai.enabled && !ai.agent_id)} role="switch" aria-checked={!!ai.enabled}
                      title={!ai.agent_id ? 'Pilih akun agent dulu' : ai.enabled ? 'Nonaktifkan AI Sales' : 'Aktifkan AI Sales'}
                    ><span className="aa-knob" /></button>
                  )}
                </div>

                {ai && (
                  <div className="rr-body">
                    {ai.ai_ready === false && <div className="rr-warn"><AlertTriangle size={14} /> OPENROUTER_API_KEY belum diset di server — AI tidak dapat membalas.</div>}
                    {ai.enabled && !autoAssign && <div className="rr-warn"><AlertTriangle size={14} /> Auto-assign sedang mati: AI hanya membalas chat yang di-assign manual ke akunnya.</div>}
                    {ai.enabled && aiAgent && aiAgent.available === false && <div className="rr-warn"><AlertTriangle size={14} /> Akun {aiAgent.name} sedang non-aktif, jadi tidak menerima chat baru dari auto-assign.</div>}
                    {ai.enabled && aiAgent && rr?.enabled && !aiAgent.region && <div className="rr-warn"><AlertTriangle size={14} /> Routing regional aktif: beri regional untuk akun {aiAgent.name} di Daftar Agent agar ikut menerima lead baru.</div>}

                    <div className="rr-grid">
                      <label className="rr-field">
                        <span>Akun agent untuk AI</span>
                        <select value={ai.agent_id || ''} onChange={e => setAi({ ...ai, agent_id: e.target.value || null })}>
                          <option value="">— Pilih akun agent —</option>
                          {agents.filter(a => a.role === 'agent').map(a => <option key={a.id} value={a.id}>{a.name} (@{a.username})</option>)}
                        </select>
                        <small>Buat akun agent khusus di Daftar Agent (mis. "Rina"), lalu pilih di sini. Chat yang di-assign ke akun ini dibalas AI.</small>
                      </label>
                      <label className="rr-field">
                        <span>Nama sales yang dipakai AI</span>
                        <input value={ai.persona_name || ''} maxLength={40} placeholder={aiAgent?.name || 'Nama akun agent'}
                          onChange={e => setAi({ ...ai, persona_name: e.target.value })} />
                        <small>Kosongkan untuk memakai nama akun agent.</small>
                      </label>
                      <label className="rr-field">
                        <span>Nama perusahaan</span>
                        <input value={ai.company ?? ''} maxLength={60} placeholder="Renus"
                          onChange={e => setAi({ ...ai, company: e.target.value })} />
                        <small>Nama yang disebut AI saat memperkenalkan diri, mis. "Renus" atau "PT Renus Global Indonesia".</small>
                      </label>
                      <label className="rr-field">
                        <span>Gaya bahasa</span>
                        <select value={ai.style || 'santai'} onChange={e => setAi({ ...ai, style: e.target.value })}>
                          <option value="santai">Santai (khas chat WA)</option>
                          <option value="sopan">Sopan & profesional</option>
                        </select>
                        <small>Contoh gaya juga dipelajari dari balasan sales asli yang berhasil closing.</small>
                      </label>
                      <label className="rr-field">
                        <span>Jeda sebelum membalas (detik)</span>
                        <input type="number" min="3" max="120" value={ai.reply_delay_sec ?? 10}
                          onChange={e => setAi({ ...ai, reply_delay_sec: e.target.value })} />
                        <small>AI menunggu pesan beruntun customer lalu membalas sekaligus, ditambah efek "sedang mengetik".</small>
                      </label>
                    </div>
                    <label className="ai-check">
                      <input type="checkbox" checked={ai.lowercase !== false} onChange={e => setAi({ ...ai, lowercase: e.target.checked })} />
                      Tulis semua balasan dengan huruf kecil agar terlihat seperti chat santai (disarankan)
                    </label>

                    <div className="ai-fu">
                      <div>
                        <b>Follow-up otomatis oleh AI</b>
                        <span>AI mengirim sendiri tugas follow-up yang jatuh tempo pada chat miliknya (chat bertag Follow-Up yang sudah Resolved), pada jam kerja (atau 08.00–20.00 bila Jam Kerja nonaktif). Pesan disusun per tahap dari template follow-up & riwayat chat. Bila customer membalas, AI menilai hasilnya (pertimbangan, keberatan, tertarik, tidak jadi) untuk Laporan Follow-up.</span>
                      </div>
                      <button className={`aa-switch${ai.followup_enabled ? ' on' : ''}`} onClick={() => saveAi({ followup_enabled: !ai.followup_enabled })}
                        disabled={aiBusy} role="switch" aria-checked={!!ai.followup_enabled}
                        title={ai.followup_enabled ? 'Matikan follow-up otomatis AI' : 'Nyalakan follow-up otomatis AI'}><span className="aa-knob" /></button>
                    </div>

                    <label className="rr-field" style={{ width: '100%' }}>
                      <span>Instruksi & info tambahan untuk AI</span>
                      <textarea rows={5} value={ai.instructions || ''} maxLength={3000}
                        placeholder={'Contoh:\n- Area layanan: Jawa Timur & Bali\n- Promo Oktober: gratis maintenance 1 tahun\n- Survei hanya Senin–Sabtu jam 08.00–16.00\n- Jangan menjanjikan cicilan'}
                        onChange={e => setAi({ ...ai, instructions: e.target.value })} />
                      <small>Harga & spesifikasi diambil dari Katalog Produk (Template & Galeri). AI tidak memberi diskon di luar yang tertulis di sini.</small>
                    </label>

                    <div className="ai-rules">
                      <b>Yang dilakukan AI otomatis</b>
                      <span>• Memasang tag <b>Prospek</b> saat penawaran sudah diberikan / customer jelas tertarik.</span>
                      <span>• Customer setuju survei & memberi alamat + waktu → dicatat di Catatan kontak & admin mendapat notifikasi.</span>
                      <span>• Komplain, garansi/servis, minta ditelepon, atau hal di luar kemampuan → AI membalas "dicek dulu" & admin mendapat notifikasi.</span>
                      <span>• Balasan ditulis seperti orang chat: dipecah 1–3 bubble pendek, pesan customer ditandai dibaca dulu, ada jeda membaca & "sedang mengetik"; ciri khas tulisan AI (tanda —, "Anda", "Semoga membantu", dll.) disaring otomatis.</span>
                      <span>• Sapaan memakai "pak/bu + nama" (tidak memakai "kak"). Bila nama belum diketahui, AI menanyakannya secara natural di awal lalu menyimpannya di Ingatan AI.</span>
                      <span>• Pesan penutup customer ("ok", "makasih", stiker) dibalas sangat singkat atau tidak dibalas.</span>
                      <span>• AI berhenti di chat bertag Deal/Non-Client, dan diam bila admin baru membalas di chat tersebut (30 menit).</span>
                    </div>

                    {aiError && <div className="am-form-err">{aiError}</div>}
                    <div className="rr-actions">
                      <button className="am-btn primary" onClick={() => saveAi()} disabled={aiBusy}>
                        {aiSaved ? <><Check size={15} /> Tersimpan</> : aiBusy ? 'Menyimpan...' : 'Simpan Pengaturan AI'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="aa-grid">
          <div className="aa-stack">
      <div className="aa-card bt-card">
        <div className="aa-info">
          <div className="aa-icon"><KeyRound size={18} /></div>
          <div>
            <div className="aa-title">Token Bot WA (Integrasi RenusPro)</div>
            <div className="aa-desc">Buat token JWT statis (tanpa kedaluwarsa) untuk sistem eksternal seperti WA Bot Notifikasi RenusPro. Tempel token ke Pengaturan RenusPro. Perlakukan seperti password.</div>
          </div>
        </div>
        <button className="am-btn primary" onClick={handleGenerateBotToken} disabled={botTokenBusy}>
          <KeyRound size={15} /> {botTokenBusy ? 'Membuat...' : 'Generate Token'}
        </button>
      </div>

      {(botToken || botTokenError) && (
        <div className="bt-result">
          {botTokenError && <div className="bt-error">{botTokenError}</div>}
          {botToken && (
            <>
              <div className="bt-warn">⚠️ Salin sekarang & simpan aman. Token tidak ditampilkan lagi setelah halaman ditutup.</div>
              <div className="bt-token-row">
                <textarea className="bt-token" readOnly value={botToken} rows={3} onFocus={e => e.target.select()} />
                <button className="am-btn" onClick={handleCopyBotToken} title="Salin token">
                  {botTokenCopied ? <Check size={15} /> : <Copy size={15} />}
                  {botTokenCopied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

          </div>
      <div className="aa-card">
        <div className="aa-info">
          <div className="aa-icon"><HardDrive size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="aa-title">Bersihkan Media Lama (Hemat Storage)</div>
            <div className="aa-desc">Hapus file media (foto/video/dokumen) lebih lama dari sekian hari untuk membebaskan penyimpanan. Pesannya tetap ada, hanya media-nya ditandai kadaluarsa.</div>
            <div className="cm-row">
              <label className="cm-label">Lebih lama dari
                <input type="number" min="1" value={cleanDays} onChange={e => setCleanDays(e.target.value)} disabled={cleanBusy} /> hari
              </label>
              <button className="am-btn danger" onClick={handleCleanupMedia} disabled={cleanBusy}>
                <Trash2 size={15} /> {cleanBusy ? 'Membersihkan...' : 'Bersihkan Sekarang'}
              </button>
              {cleanResult != null && !cleanBusy && (
                <span className="cm-result"><Check size={14} /> {cleanResult} media dihapus</span>
              )}
            </div>
          </div>
        </div>
      </div>

        </div>
      )}

      {modal === 'create' && (
        <Modal title="Tambah Agent Baru" onClose={() => setModal(null)}>
          <AgentForm onSave={handleCreate} onClose={() => setModal(null)} loading={saving} error={formError} isEdit={false} />
        </Modal>
      )}

      {modal?.agent && (
        <Modal title="Edit Agent" onClose={() => setModal(null)}>
          <AgentForm
            initial={{ ...modal.agent, password: '', confirmPassword: '' }}
            onSave={handleUpdate}
            onClose={() => setModal(null)}
            loading={saving}
            error={formError}
            isEdit
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Hapus Agent" onClose={() => setDeleteTarget(null)}>
          <div className="am-confirm">
            <p>Yakin ingin menghapus agent <strong>{deleteTarget.name}</strong>?</p>
            <p className="am-confirm-sub">Tindakan ini tidak dapat dibatalkan.</p>
            {deleteError && <div className="am-form-err">{deleteError}</div>}
            <div className="am-form-actions">
              <button className="am-btn secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
              <button className="am-btn danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .am-page { padding: 24px 24px 40px; width: 100%; color: var(--text); }
        .am-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
        .am-header h1 { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; color: var(--text); }
        .am-count { font-size: 11.5px; font-weight: 700; color: var(--text2); background: var(--surface); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
        /* Tab */
        .am-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 16px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); overflow-x: auto; scrollbar-width: none; }
        .am-tabs::-webkit-scrollbar { display: none; }
        .am-tab { position: relative; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text2); white-space: nowrap; transition: background 0.15s, color 0.15s; }
        .am-tab:hover:not(.active) { background: var(--surface3); }
        .am-tab.active { background: var(--primary); color: var(--on-primary); box-shadow: 0 1px 3px var(--shadow); }
        .am-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--warning, #d08b28); }
        .am-tab.active .am-tab-dot { background: #fff; }
        /* Kartu pengaturan */
        .aa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        .aa-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .aa-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 3px var(--shadow); min-width: 0; }
        .aa-grid .rr-card { grid-column: 1 / -1; }
        .rr-card > .aa-info { flex: 1; width: 100%; }
        .aa-info { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
        .aa-icon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--primary-light); color: var(--primary); }
        .aa-title { font-size: 14.5px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
        .aa-desc { font-size: 12.5px; color: var(--text2); line-height: 1.55; max-width: 680px; }
        .aa-switch { position: relative; width: 46px; height: 26px; border-radius: 999px; background: var(--border2); flex-shrink: 0; transition: background 0.2s; }
        .aa-switch.on { background: var(--success); }
        .aa-switch:disabled { opacity: 0.6; cursor: not-allowed; }
        .aa-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: transform 0.2s; }
        .aa-switch.on .aa-knob { transform: translateX(20px); }
        .aa-switch.sm { width: 38px; height: 22px; }
        .aa-switch.sm .aa-knob { width: 16px; height: 16px; top: 3px; left: 3px; }
        .aa-switch.sm.on .aa-knob { transform: translateX(16px); }
        .bt-card { flex-wrap: wrap; }
        .bt-result { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px var(--shadow); }
        .bt-error { color: var(--danger); font-size: 13px; }
        .bt-warn { color: var(--warning); font-size: 12.5px; background: rgba(208,139,40,0.1); border: 1px solid rgba(208,139,40,0.3); border-radius: 9px; padding: 8px 10px; margin-bottom: 10px; }
        .bt-token-row { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
        .bt-token { flex: 1; min-width: 220px; font-family: ui-monospace, monospace; font-size: 12px; color: var(--text); background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; resize: vertical; word-break: break-all; }
        .wh-body { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
        .wh-enable { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text); cursor: pointer; }
        .wh-enable input { width: 16px; height: 16px; accent-color: var(--primary); }
        .wh-controls { display: flex; flex-direction: column; gap: 10px; }
        .wh-controls.disabled { opacity: 0.5; }
        .wh-days { display: flex; gap: 6px; flex-wrap: wrap; }
        .wh-day { width: 44px; height: 34px; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--text2); background: var(--surface2); border: 1px solid var(--border); }
        .wh-day.on { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
        .wh-times { display: flex; gap: 16px; flex-wrap: wrap; }
        .wh-times label { font-size: 13px; color: var(--text2); display: flex; align-items: center; gap: 8px; }
        .wh-times input[type="time"] { height: 36px; border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; font-size: 13px; color: var(--text); background: var(--surface2); font-family: inherit; }
        .wh-save { align-self: flex-start; }
        .cm-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
        .cm-label { font-size: 13px; color: var(--text2); display: inline-flex; align-items: center; gap: 8px; }
        .cm-label input { width: 74px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px; font-size: 13px; color: var(--text); background: var(--surface2); }
        .cm-result { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--success); }
        .ai-subnav { display: inline-flex; gap: 2px; padding: 3px; margin-bottom: 14px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); max-width: 100%; overflow-x: auto; }
        .ai-subnav button { height: 32px; padding: 0 14px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; }
        .ai-subnav button:hover:not(.active) { background: var(--surface3); }
        .ai-subnav button.active { background: var(--primary); color: var(--on-primary); }
        .ai-badge { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; color: #7c3aed; background: rgba(124,58,237,0.13); }
        .ai-check { display: flex; align-items: center; gap: 7px; margin-top: 4px; font-size: 12.5px; font-weight: 500; color: var(--text2); cursor: pointer; }
        .ai-check input { width: 15px; height: 15px; accent-color: var(--primary); }
        .ai-fu { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); }
        .ai-fu > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ai-fu b { font-size: 13.5px; color: var(--text); }
        .ai-fu span { font-size: 12px; line-height: 1.5; color: var(--muted); }
        .ai-rules { display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 12px 14px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); font-size: 12.5px; color: var(--text2); line-height: 1.5; }
        .ai-rules b { color: var(--text); }
        .rr-field select { height: 38px; border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; font-size: 13px; color: var(--text); background: var(--surface2); font-family: inherit; }
        .rr-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .rr-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .rr-body { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; align-items: flex-start; }
        .rr-status { display: flex; gap: 8px; flex-wrap: wrap; }
        .rr-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); }
        .rr-chip.barat { color: #3b82f6; background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.3); }
        .rr-chip.timur { color: #d97706; background: rgba(217,119,6,0.1); border-color: rgba(217,119,6,0.3); }
        .rr-warn { display: flex; align-items: flex-start; gap: 7px; font-size: 12.5px; line-height: 1.5; color: var(--warning, #d08b28); background: rgba(208,139,40,0.1); border: 1px solid rgba(208,139,40,0.3); border-radius: 9px; padding: 8px 10px; width: 100%; }
        .rr-warn svg { flex-shrink: 0; margin-top: 2px; }
        .rr-grid, .rr-msgs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; }
        .rr-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
        .rr-field > span { font-weight: 600; color: var(--text2); }
        .rr-field input, .rr-field textarea { width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface2); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; line-height: 1.45; }
        .rr-field input:focus, .rr-field textarea:focus { outline: none; border-color: var(--primary); background: var(--surface); }
        .rr-field small { color: var(--muted); font-size: 11.5px; line-height: 1.4; }
        .am-region-select { height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .am-region-select.barat { color: #3b82f6; border-color: rgba(37,99,235,0.4); }
        .am-region-select.timur { color: #d97706; border-color: rgba(217,119,6,0.4); }
        .am-region-select.none { color: var(--warning, #d08b28); border-style: dashed; }
        .am-region-select:disabled { opacity: 0.6; cursor: not-allowed; }
        .am-avail { display: flex; align-items: center; gap: 8px; }
        .am-avail-label { font-size: 12px; font-weight: 600; color: var(--muted); }
        .am-avail-label.on { color: var(--success); }
        .am-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 600; transition: all 0.15s; white-space: nowrap; }
        .am-btn.primary { background: var(--primary); color: var(--on-primary); }
        .am-btn.primary:hover:not(:disabled) { background: var(--primary-hover); }
        .am-btn.secondary, .am-btn:not(.primary):not(.danger) { background: var(--surface2); color: var(--text2); border: 1px solid var(--border); }
        .am-btn.secondary:hover:not(:disabled) { background: var(--surface3); }
        .am-btn.danger { background: rgba(229,62,62,0.1); color: var(--danger); border: 1px solid rgba(229,62,62,0.3); }
        .am-btn.danger:hover:not(:disabled) { background: rgba(229,62,62,0.16); }
        .am-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        /* Tabel agent */
        .am-table-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px var(--shadow); }
        .am-table-wrap { overflow-x: auto; }
        .am-table { width: 100%; border-collapse: collapse; }
        .am-table th { text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap; }
        .am-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); color: var(--text); }
        .am-table tr:last-child td { border-bottom: none; }
        .am-table tr:hover td { background: var(--surface2); }
        .am-agent-cell { display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .am-avatar { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .am-username { font-size: 13px; color: var(--text2); }
        .am-email { color: var(--text2); font-size: 13px; }
        .am-date { color: var(--muted); font-size: 12.5px; white-space: nowrap; }
        .am-role { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
        .am-role.admin { background: rgba(208,139,40,0.14); color: var(--warning); }
        .am-role.agent { background: var(--primary-light); color: var(--primary); }
        .am-actions { display: flex; gap: 4px; }
        .am-icon-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .am-icon-btn.edit:hover { background: var(--primary-light); color: var(--primary); }
        .am-icon-btn.del:hover { background: rgba(229,62,62,0.1); color: var(--danger); }
        .am-loading { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .am-skel { height: 52px; background: var(--skeleton); border-radius: 9px; animation: pulse 1.4s ease infinite; }
        .am-empty { padding: 60px 20px; text-align: center; color: var(--muted); font-size: 14px; display: flex; flex-direction: column; align-items: center; }
        /* Kartu agent (HP) */
        .am-card-list { display: none; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .am-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--border); }
        .am-card:last-child { border-bottom: none; }
        .am-card-top { display: flex; align-items: center; gap: 11px; }
        .am-card-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .am-card-name { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .am-card-sub { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
        .am-card-ctrl { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-left: 45px; }
        /* Modal */
        .am-overlay { position: fixed; inset: 0; z-index: 500; background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .am-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; max-height: calc(100vh - 32px); overflow-y: auto; }
        .am-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
        .am-modal-header h3 { font-size: 15px; font-weight: 700; color: var(--text); }
        .am-close { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s; }
        .am-close:hover { background: var(--surface3); color: var(--text2); }
        .am-form { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
        .am-field { display: flex; flex-direction: column; gap: 6px; }
        .am-field label { font-size: 12px; color: var(--text2); font-weight: 600; }
        .am-field input, .am-field select { height: 40px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); padding: 0 12px; font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
        .am-field input:focus, .am-field select:focus { border-color: var(--primary); background: var(--surface); }
        .am-field input::placeholder { color: var(--muted); }
        .req { color: var(--danger); }
        .am-pw-wrap { position: relative; }
        .am-pw-wrap input { width: 100%; padding-right: 40px; }
        .am-pw-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--muted); padding: 4px; }
        .am-pw-eye:hover { color: var(--text2); }
        .am-hint { font-size: 11.5px; color: var(--muted); }
        .am-hint.err { color: var(--danger); }
        .am-form-err { padding: 10px 14px; background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.3); border-radius: 9px; color: var(--danger); font-size: 13px; }
        .am-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
        .am-confirm { padding: 18px; }
        .am-confirm p { font-size: 14px; color: var(--text); margin-bottom: 6px; }
        .am-confirm-sub { font-size: 13px; color: var(--text2); }
        .am-confirm .am-form-actions { margin-top: 18px; }
        @media (max-width: 860px) { .aa-grid, .rr-grid, .rr-msgs { grid-template-columns: 1fr; } }
        @media (max-width: 768px) {
          .am-page { padding: 16px 14px 28px; }
          .am-tab { flex: 0 0 auto; }
          .am-table-box { display: none; }
          .am-card-list { display: flex; }
          .aa-card { padding: 14px; }
          .rr-head { flex-direction: row; }
        }
        @media (max-width: 420px) { .am-hide-xs { display: none; } .am-header .am-btn { width: 38px; padding: 0; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

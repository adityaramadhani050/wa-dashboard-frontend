import { useState, useEffect, useCallback } from 'react'
import { getAgents, createAgent, updateAgent, deleteAgent, getAutoAssign, setAutoAssign } from '../hooks/useApi'
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Users, Shuffle } from 'lucide-react'

const EMPTY_FORM = { name: '', username: '', email: '', role: 'agent', password: '', confirmPassword: '' }

const AVATAR_COLORS = ['#3563e9','#27a87a','#d08b28','#e05c8a','#7c5cd6','#2aaccc']
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
        <label>Email <span style={{fontSize:11,color:'#94a3b8'}}>(opsional)</span></label>
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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [autoAssign, setAutoAssignState] = useState(false)
  const [autoAssignBusy, setAutoAssignBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setAgents(await getAgents()) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getAutoAssign().then(d => setAutoAssignState(!!d.enabled)).catch(() => {}) }, [])

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
        <div>
          <h1>Manajemen Agent</h1>
          <p>Kelola akun agent dan admin</p>
        </div>
        <button className="am-btn primary" onClick={() => { setFormError(''); setModal('create') }}>
          <Plus size={16} /> Tambah Agent
        </button>
      </div>

      <div className="aa-card">
        <div className="aa-info">
          <div className="aa-icon"><Shuffle size={18} /></div>
          <div>
            <div className="aa-title">Auto-assign Chat (Round-robin)</div>
            <div className="aa-desc">Bagi chat masuk ke agent secara seimbang berdasarkan jumlah chat aktif yang sedang ditangani. Saat diaktifkan, chat yang belum ter-assign langsung dibagikan.</div>
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
                      </div>
                    </td>
                    <td><span className="am-username">@{a.username || '—'}</span></td>
                    <td className="am-email">{a.email || <span style={{color:'#cbd5e1'}}>-</span>}</td>
                    <td>{roleBadge(a.role)}</td>
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
        .am-page { padding: 24px 24px 40px; width: 100%; color: #1e293b; }
        .am-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; margin-bottom: 20px;
        }
        .am-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 3px; color: #1e293b; }
        .am-header p { font-size: 13px; color: #64748b; }
        .aa-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .aa-info { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
        .aa-icon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(53,99,233,0.1); color: #3563e9; }
        .aa-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
        .aa-desc { font-size: 12px; color: #64748b; line-height: 1.5; max-width: 640px; }
        .aa-switch { position: relative; width: 46px; height: 26px; border-radius: 999px; background: #cbd5e1; flex-shrink: 0; transition: background 0.2s; }
        .aa-switch.on { background: #27a87a; }
        .aa-switch:disabled { opacity: 0.6; cursor: not-allowed; }
        .aa-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s; }
        .aa-switch.on .aa-knob { transform: translateX(20px); }
        .am-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px;
          font-size: 13px; font-weight: 600; transition: all 0.15s;
          white-space: nowrap;
        }
        .am-btn.primary { background: #2563eb; color: white; }
        .am-btn.primary:hover { background: #1d4ed8; }
        .am-btn.secondary { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
        .am-btn.secondary:hover { background: #f0f4f8; }
        .am-btn.danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .am-btn.danger:hover { background: #fee2e2; }
        .am-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .am-table-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .am-table-wrap { overflow-x: auto; }
        .am-table { width: 100%; border-collapse: collapse; }
        .am-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .am-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f0f4f8; color: #1e293b; }
        .am-table tr:last-child td { border-bottom: none; }
        .am-table tr:hover td { background: #f8fafc; }
        .am-agent-cell { display: flex; align-items: center; gap: 10px; }
        .am-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700;
        }
        .am-username { font-size: 13px; color: #2563eb; font-weight: 500; font-family: monospace; }
        .am-email { color: #64748b; font-size: 13px; }
        .am-date { color: #94a3b8; font-size: 12px; }
        .am-role { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .am-role.admin { background: #fffbeb; color: #d97706; }
        .am-role.agent { background: #eff6ff; color: #2563eb; }
        .am-actions { display: flex; gap: 6px; }
        .am-icon-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .am-icon-btn.edit { color: #94a3b8; }
        .am-icon-btn.edit:hover { background: #eff6ff; color: #2563eb; }
        .am-icon-btn.del { color: #94a3b8; }
        .am-icon-btn.del:hover { background: #fef2f2; color: #dc2626; }
        .am-loading { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .am-skel { height: 56px; background: #f0f4f8; border-radius: 8px; animation: pulse 1.4s ease infinite; }
        .am-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; display: flex; flex-direction: column; align-items: center; }
        .am-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .am-modal { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
        .am-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .am-modal-header h3 { font-size: 15px; font-weight: 600; color: #1e293b; }
        .am-close { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.15s; }
        .am-close:hover { background: #e2e8f0; color: #475569; }
        .am-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .am-field { display: flex; flex-direction: column; gap: 5px; }
        .am-field label { font-size: 12px; color: #475569; font-weight: 600; }
        .am-field input, .am-field select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; color: #1e293b; padding: 10px 14px; font-size: 14px; outline: none; transition: border-color 0.15s; }
        .am-field input:focus, .am-field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .am-field input::placeholder { color: #cbd5e1; }
        .req { color: #dc2626; }
        .am-pw-wrap { position: relative; }
        .am-pw-wrap input { width: 100%; padding-right: 40px; }
        .am-pw-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; padding: 4px; }
        .am-pw-eye:hover { color: #475569; }
        .am-hint { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .am-hint.err { color: #dc2626; }
        .am-form-err { padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; color: #dc2626; font-size: 13px; }
        .am-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .am-confirm { padding: 20px; }
        .am-confirm p { font-size: 14px; color: #1e293b; margin-bottom: 6px; }
        .am-confirm-sub { font-size: 13px; color: #64748b; }
        .am-confirm .am-form-actions { margin-top: 20px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Megaphone, ArrowLeft, Search, Send, Clock, Users, Image as ImageIcon,
  Play, Pause, X, CheckCircle2, AlertCircle, RefreshCw, Calendar, MessageSquareText,
} from 'lucide-react'
import {
  getBroadcastCandidates, getBroadcastCampaigns, getBroadcastCampaign,
  createBroadcastCampaign, startBroadcastCampaign, pauseBroadcastCampaign,
  cancelBroadcastCampaign, getBroadcastTemplates,
} from '../hooks/useApi'

const STATUS_LABEL = {
  draft: 'Draft', scheduled: 'Terjadwal', running: 'Berjalan',
  paused: 'Dijeda', completed: 'Selesai', canceled: 'Dibatalkan',
}

function fmtDate(s) {
  if (!s) return '-'
  return new Date(s).toLocaleString('id', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function applySample(text, name) {
  if (!text) return ''
  return text.replace(/\{\{\s*nama\s*\}\}/gi, name || 'Budi')
}

// Preview WhatsApp room chat (dari sisi penerima -> pesan masuk / bubble kiri)
function PhonePreview({ text, mediaType, mediaUrl, mediaLabel, sampleName = 'Budi' }) {
  const now = new Date().toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit' })
  const body = applySample(text, sampleName)
  const hasMedia = !!mediaType
  return (
    <div className="bc-side">
      <div className="bc-phone">
        <div className="bc-phone-notch" />
        <div className="bc-wa-header">
          <ArrowLeft size={18} />
          <div className="bc-wa-avatar">{(sampleName || 'C')[0].toUpperCase()}</div>
          <div className="bc-wa-hinfo">
            <span className="bc-wa-name">{sampleName || 'Calon Customer'}</span>
            <span className="bc-wa-status">online</span>
          </div>
        </div>
        <div className="bc-wa-body">
          <div className="bc-wa-date">HARI INI</div>
          {(hasMedia || body) && (
            <div className="bc-wa-bubble">
              {hasMedia && (
                mediaType === 'image' && mediaUrl
                  ? <img className="bc-wa-media" src={mediaUrl} alt={mediaLabel || ''} />
                  : <div className="bc-wa-doc"><ImageIcon size={18} /><span>{mediaLabel || mediaType}</span></div>
              )}
              {body && <div className="bc-wa-text">{body}</div>}
              <span className="bc-wa-time">{now}</span>
            </div>
          )}
          {!hasMedia && !body && <div className="bc-wa-empty">Isi pesan akan tampil di sini…</div>}
        </div>
      </div>
    </div>
  )
}

// ── Daftar campaign ─────────────────────────────────────────────────────────
function CampaignList({ campaigns, loading, onNew, onOpen, onReload }) {
  return (
    <div className="bc-page">
      <div className="bc-header">
        <div className="bc-title-wrap">
          <div>
            <div className="bc-title"><Megaphone size={20} /> Broadcast Promo</div>
            <div className="bc-sub">Kirim pesan promo ke calon customer yang pernah menghubungi tapi belum deal.</div>
          </div>
        </div>
        <div className="bc-header-actions">
          <button className="bc-btn ghost" onClick={onReload} title="Muat ulang"><RefreshCw size={16} /></button>
          <button className="bc-btn primary" onClick={onNew}><Megaphone size={16} /> Buat Broadcast</button>
        </div>
      </div>

      <div className="bc-notice">
        <AlertCircle size={16} />
        <span>Demi keamanan akun WhatsApp: pengiriman bertahap dengan jeda acak, dibatasi per hari, hanya di jam kerja, dan setiap nomor punya masa jeda (cooldown) agar tidak spam.</span>
      </div>

      {loading ? (
        <div className="bc-empty">Memuat…</div>
      ) : campaigns.length === 0 ? (
        <div className="bc-empty">Belum ada campaign. Klik "Buat Broadcast" untuk memulai.</div>
      ) : (
        <div className="bc-list">
          {campaigns.map(c => {
            const done = (c.sent_count || 0) + (c.failed_count || 0) + (c.skipped_count || 0)
            const pct = c.total_targets ? Math.round(done / c.total_targets * 100) : 0
            return (
              <button key={c.id} className="bc-card" onClick={() => onOpen(c.id)}>
                <div className="bc-card-top">
                  <span className="bc-card-name">{c.name}</span>
                  <span className={`bc-status ${c.status}`}>{STATUS_LABEL[c.status] || c.status}</span>
                </div>
                <div className="bc-card-meta">
                  {c.message_type === 'quick_media' ? <><ImageIcon size={13} /> Media</> : 'Teks'}
                  <span>•</span>
                  <Users size={13} /> {c.total_targets} target
                  {c.status === 'scheduled' && c.start_at && <><span>•</span><Calendar size={13} /> {fmtDate(c.start_at)}</>}
                </div>
                <div className="bc-progress"><div className="bc-progress-bar" style={{ width: `${pct}%` }} /></div>
                <div className="bc-card-stats">
                  <span className="ok">{c.sent_count || 0} terkirim</span>
                  <span className="skip">{c.skipped_count || 0} dilewati</span>
                  <span className="fail">{c.failed_count || 0} gagal</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Detail campaign ─────────────────────────────────────────────────────────
function CampaignDetail({ id, onBack, onChanged }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await getBroadcastCampaign(id)) } catch {}
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (data?.campaign?.status !== 'running') return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [data?.campaign?.status, load])

  const act = async (fn) => {
    setBusy(true)
    try { await fn(id); await load(); onChanged?.() } catch (e) { alert(e?.response?.data?.error || 'Gagal') }
    finally { setBusy(false) }
  }

  if (!data) return <div className="bc-page"><div className="bc-empty">Memuat…</div></div>
  const c = data.campaign
  const done = (c.sent_count || 0) + (c.failed_count || 0) + (c.skipped_count || 0)
  const pct = c.total_targets ? Math.round(done / c.total_targets * 100) : 0
  const sampleName = data.recipients?.[0]?.name || 'Budi'

  return (
    <div className="bc-page">
      <div className="bc-header">
        <div className="bc-title-wrap">
          <button className="bc-back" onClick={onBack}><ArrowLeft size={18} /></button>
          <div>
            <div className="bc-title">{c.name}</div>
          </div>
        </div>
        <div className="bc-header-actions">
          {(c.status === 'draft' || c.status === 'paused' || c.status === 'scheduled') && (
            <button className="bc-btn primary" disabled={busy} onClick={() => act(startBroadcastCampaign)}><Play size={15} /> Mulai Sekarang</button>
          )}
          {c.status === 'running' && (
            <button className="bc-btn warn" disabled={busy} onClick={() => act(pauseBroadcastCampaign)}><Pause size={15} /> Jeda</button>
          )}
          {['draft', 'scheduled', 'running', 'paused'].includes(c.status) && (
            <button className="bc-btn danger" disabled={busy} onClick={() => { if (confirm('Batalkan campaign ini?')) act(cancelBroadcastCampaign) }}><X size={15} /> Batalkan</button>
          )}
        </div>
      </div>

      <div className="bc-layout">
       <div className="bc-main">
      <div className="bc-detail-grid">
        <div className="bc-stat"><span className="bc-stat-num">{c.total_targets}</span><span className="bc-stat-lbl">Total Target</span></div>
        <div className="bc-stat ok"><span className="bc-stat-num">{c.sent_count || 0}</span><span className="bc-stat-lbl">Terkirim</span></div>
        <div className="bc-stat skip"><span className="bc-stat-num">{c.skipped_count || 0}</span><span className="bc-stat-lbl">Dilewati</span></div>
        <div className="bc-stat fail"><span className="bc-stat-num">{c.failed_count || 0}</span><span className="bc-stat-lbl">Gagal</span></div>
      </div>
      <div className="bc-progress lg"><div className="bc-progress-bar" style={{ width: `${pct}%` }} /></div>

      <div className="bc-info-row">
        <span><Users size={13} /> Batas {c.daily_limit}/hari</span>
        <span><Clock size={13} /> Cooldown {c.cooldown_days} hari</span>
        {c.start_at && <span><Calendar size={13} /> Jadwal {fmtDate(c.start_at)}</span>}
        <span className={`bc-status ${c.status}`} style={{ marginLeft: 'auto' }}>{STATUS_LABEL[c.status]}</span>
      </div>

      <div className="bc-recip-head">Penerima ({data.recipients.length})</div>
      <div className="bc-recip-list">
        {data.recipients.map(r => (
          <div key={r.id} className="bc-recip">
            <div className="bc-recip-info">
              <span className="bc-recip-name">{r.name || r.phone}</span>
              <span className="bc-recip-phone">{r.phone}</span>
            </div>
            <span className={`bc-recip-status ${r.status}`}>
              {r.status === 'sent' && <><CheckCircle2 size={13} /> Terkirim</>}
              {r.status === 'pending' && 'Menunggu'}
              {r.status === 'skipped' && `Dilewati${r.skip_reason === 'cooldown' ? ' (cooldown)' : r.skip_reason === 'invalid_number' ? ' (nomor tidak aktif)' : ''}`}
              {r.status === 'failed' && <><AlertCircle size={13} /> Gagal</>}
            </span>
          </div>
        ))}
      </div>
       </div>
       <PhonePreview
         text={c.message_body}
         mediaType={c.media_url ? (c.media_type || 'image') : null}
         mediaUrl={c.media_url || null}
         mediaLabel={c.media_filename || null}
         sampleName={sampleName}
       />
      </div>
    </div>
  )
}

// ── Wizard buat campaign ────────────────────────────────────────────────────
function CreateWizard({ onBack, onCreated }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState(null)

  const [cooldownDays, setCooldownDays] = useState(14)
  const [dailyLimit, setDailyLimit] = useState(40)
  const [startMode, setStartMode] = useState('now') // now | schedule
  const [startAt, setStartAt] = useState('')

  const [candidates, setCandidates] = useState([])
  const [loadingCand, setLoadingCand] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getBroadcastTemplates().then(setTemplates).catch(() => {})
  }, [])

  const template = templates.find(t => t.id === templateId) || null

  const loadCandidates = useCallback(async (cd) => {
    setLoadingCand(true)
    try {
      const r = await getBroadcastCandidates(cd)
      setCandidates(r.candidates || [])
    } catch { setCandidates([]) }
    finally { setLoadingCand(false) }
  }, [])

  // Muat kandidat saat masuk step 2 (atau cooldown berubah)
  useEffect(() => { if (step === 2) loadCandidates(cooldownDays) }, [step, cooldownDays, loadCandidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
  }, [candidates, search])

  const selectableAll = () => {
    const next = new Set(selected)
    filtered.forEach(c => { if (!c.on_cooldown) next.add(c.wa_jid) })
    setSelected(next)
  }
  const clearAll = () => setSelected(new Set())
  const toggle = (jid) => {
    const next = new Set(selected)
    next.has(jid) ? next.delete(jid) : next.add(jid)
    setSelected(next)
  }

  const chosen = candidates.filter(c => selected.has(c.wa_jid) && !c.on_cooldown)

  const canStep1 = name.trim() && templateId
  const estDays = chosen.length ? Math.ceil(chosen.length / (dailyLimit || 40)) : 0

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        broadcast_template_id: templateId,
        daily_limit: dailyLimit,
        cooldown_days: cooldownDays,
        recipients: chosen.map(c => ({
          conversation_id: c.conversation_id, contact_id: c.contact_id,
          wa_jid: c.wa_jid, name: c.name, phone: c.phone,
        })),
      }
      if (startMode === 'schedule' && startAt) payload.start_at = new Date(startAt).toISOString()
      const { campaign } = await createBroadcastCampaign(payload)
      // Mulai sekarang -> jalankan langsung
      if (startMode === 'now') { try { await startBroadcastCampaign(campaign.id) } catch {} }
      onCreated(campaign.id)
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal membuat campaign')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="bc-page">
      <div className="bc-header">
        <div className="bc-title-wrap">
          <button className="bc-back" onClick={onBack}><ArrowLeft size={18} /></button>
          <div className="bc-title">Buat Broadcast</div>
        </div>
      </div>

      <div className="bc-layout">
       <div className="bc-main">
      <div className="bc-steps">
        {['Pesan', 'Penerima', 'Review'].map((s, i) => (
          <div key={s} className={`bc-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
            <span className="bc-step-num">{i + 1}</span>{s}
          </div>
        ))}
      </div>

      {/* STEP 1 — Pesan */}
      {step === 1 && (
        <div className="bc-form">
          <div className="bc-field">
            <label>Nama Campaign</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="mis. Promo Panel Surya Agustus" />
          </div>
          <div className="bc-field">
            <label>Pilih Template Broadcast</label>
            {templates.length === 0 ? (
              <div className="bc-hint">Belum ada template broadcast. Buat dulu di menu <b>Template &amp; Galeri → Template Broadcast</b>.</div>
            ) : (
              <select value={templateId || ''} onChange={e => setTemplateId(e.target.value || null)}>
                <option value="" disabled>Pilih template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.media_url ? ' (media)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <div className="bc-form-actions">
            <button className="bc-btn primary" disabled={!canStep1} onClick={() => setStep(2)}>Lanjut: Pilih Penerima</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Penerima */}
      {step === 2 && (
        <div className="bc-form">
          <div className="bc-recip-toolbar">
            <div className="bc-search">
              <Search size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor…" />
            </div>
            <button className="bc-btn ghost sm" onClick={selectableAll}>Pilih semua yang boleh</button>
            <button className="bc-btn ghost sm" onClick={clearAll}>Kosongkan</button>
          </div>
          <div className="bc-hint" style={{ marginBottom: 8 }}>
            Kandidat: chat berstatus <b>Resolved</b> (bukan Non-Client). Nomor yang masih dalam cooldown tidak bisa dipilih. Dipilih: <b>{chosen.length}</b>
          </div>

          {loadingCand ? (
            <div className="bc-empty">Memuat kandidat…</div>
          ) : filtered.length === 0 ? (
            <div className="bc-empty">Tidak ada kandidat.</div>
          ) : (
            <div className="bc-cand-list">
              {filtered.map(c => (
                <label key={c.wa_jid} className={`bc-cand ${c.on_cooldown ? 'disabled' : ''}`}>
                  <input type="checkbox" disabled={c.on_cooldown}
                    checked={selected.has(c.wa_jid)} onChange={() => toggle(c.wa_jid)} />
                  <div className="bc-cand-info">
                    <span className="bc-cand-name">{c.name || c.phone}</span>
                    <span className="bc-cand-phone">{c.phone}</span>
                  </div>
                  {c.on_cooldown
                    ? <span className="bc-cand-cd"><Clock size={12} /> cooldown s/d {fmtDate(c.cooldown_until)}</span>
                    : <span className="bc-cand-ok">boleh</span>}
                </label>
              ))}
            </div>
          )}

          <div className="bc-form-actions between">
            <button className="bc-btn ghost" onClick={() => setStep(1)}>Kembali</button>
            <button className="bc-btn primary" disabled={chosen.length === 0} onClick={() => setStep(3)}>Lanjut: Review ({chosen.length})</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Review */}
      {step === 3 && (
        <div className="bc-form">
          <div className="bc-review-grid">
            <div className="bc-field">
              <label>Batas per hari</label>
              <input type="number" min={1} max={500} value={dailyLimit} onChange={e => setDailyLimit(Math.max(1, parseInt(e.target.value) || 40))} />
              <span className="bc-hint">Disarankan mulai dari 40/hari, naikkan bertahap.</span>
            </div>
            <div className="bc-field">
              <label>Cooldown (hari)</label>
              <input type="number" min={1} max={365} value={cooldownDays} onChange={e => setCooldownDays(Math.max(1, parseInt(e.target.value) || 14))} />
              <span className="bc-hint">Jeda minimum sebelum satu nomor boleh dikirim lagi.</span>
            </div>
          </div>

          <div className="bc-field">
            <label>Waktu Mulai</label>
            <div className="bc-mode-tabs">
              <button className={startMode === 'now' ? 'active' : ''} onClick={() => setStartMode('now')}><Play size={13} /> Mulai sekarang</button>
              <button className={startMode === 'schedule' ? 'active' : ''} onClick={() => setStartMode('schedule')}><Calendar size={13} /> Jadwalkan</button>
            </div>
            {startMode === 'schedule' && (
              <input type="datetime-local" style={{ marginTop: 8 }} value={startAt} onChange={e => setStartAt(e.target.value)} />
            )}
          </div>

          <div className="bc-summary">
            <div><span>Campaign</span><b>{name}</b></div>
            <div><span>Template</span><b>{template?.name || '-'}</b></div>
            <div><span>Penerima</span><b>{chosen.length} nomor</b></div>
            <div><span>Estimasi durasi</span><b>{estDays} hari (≈{dailyLimit}/hari)</b></div>
            {startMode === 'schedule' && startAt && <div><span>Mulai</span><b>{fmtDate(startAt)}</b></div>}
          </div>

          <div className="bc-form-actions between">
            <button className="bc-btn ghost" onClick={() => setStep(2)}>Kembali</button>
            <button className="bc-btn primary" disabled={submitting || (startMode === 'schedule' && !startAt)} onClick={submit}>
              <Send size={15} /> {submitting ? 'Menyimpan…' : startMode === 'now' ? 'Buat & Mulai' : 'Buat & Jadwalkan'}
            </button>
          </div>
        </div>
      )}
       </div>
       <PhonePreview
         text={template?.body}
         mediaType={template?.media_type || null}
         mediaUrl={template?.media_url || null}
         mediaLabel={template?.media_filename || null}
       />
      </div>
    </div>
  )
}

// ── Root ────────────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const [view, setView] = useState('list') // list | create | detail
  const [detailId, setDetailId] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setCampaigns(await getBroadcastCampaigns()) } catch {}
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="bc-root">
      {view === 'list' && (
        <CampaignList campaigns={campaigns} loading={loading} onReload={load}
          onNew={() => setView('create')}
          onOpen={(id) => { setDetailId(id); setView('detail') }} />
      )}
      {view === 'create' && (
        <CreateWizard onBack={() => setView('list')}
          onCreated={(id) => { load(); setDetailId(id); setView('detail') }} />
      )}
      {view === 'detail' && detailId && (
        <CampaignDetail id={detailId} onBack={() => { load(); setView('list') }} onChanged={load} />
      )}
      <style>{BC_CSS}</style>
    </div>
  )
}

const BC_CSS = `
.bc-root { height: 100%; overflow-y: auto; background: var(--bg); }
.bc-page { width: 100%; padding: 24px 24px 48px; color: var(--text); }
.bc-layout { display: flex; flex-direction: row-reverse; gap: 32px; align-items: stretch; width: 100%; }
.bc-main { flex: 1 1 60%; min-width: 0; }
.bc-side { flex: 0 0 40%; max-width: 40%; position: sticky; top: 0; height: calc(100vh - 40px); display: flex; justify-content: center; }
.bc-phone { width: 100%; max-width: 340px; height: 100%; max-height: 720px; display: flex; flex-direction: column; border-radius: 30px; overflow: hidden; background: #0b141a; border: 9px solid #111b21; box-shadow: 0 12px 40px var(--shadow); }
.bc-phone-notch { height: 22px; background: #111b21; position: relative; flex-shrink: 0; }
.bc-phone-notch::after { content: ''; position: absolute; left: 50%; top: 6px; transform: translateX(-50%); width: 90px; height: 8px; border-radius: 999px; background: #0b141a; }
.bc-wa-header { display: flex; align-items: center; gap: 9px; padding: 10px 12px; background: #202c33; color: #e9edef; flex-shrink: 0; }
.bc-wa-avatar { width: 30px; height: 30px; border-radius: 50%; background: #6a7175; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.bc-wa-hinfo { display: flex; flex-direction: column; min-width: 0; }
.bc-wa-name { font-size: 13.5px; font-weight: 600; color: #e9edef; }
.bc-wa-status { font-size: 11px; color: #8696a0; }
.bc-wa-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 12px; background-color: #0b141a; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='%23131f28' fill-opacity='0.5'%3E%3Ccircle cx='12' cy='12' r='2'/%3E%3Ccircle cx='42' cy='30' r='2'/%3E%3Ccircle cx='20' cy='48' r='2'/%3E%3C/g%3E%3C/svg%3E"); }
.bc-wa-date { text-align: center; margin: 0 auto 12px; width: fit-content; font-size: 10.5px; color: #8696a0; background: #182229; padding: 4px 10px; border-radius: 7px; }
.bc-wa-bubble { max-width: 82%; background: #202c33; border-radius: 8px; border-top-left-radius: 0; padding: 7px 9px 5px; position: relative; box-shadow: 0 1px 1px rgba(0,0,0,0.2); }
.bc-wa-media { width: 100%; border-radius: 5px; margin-bottom: 5px; display: block; }
.bc-wa-doc { display: flex; align-items: center; gap: 7px; background: #111b21; border-radius: 6px; padding: 10px; margin-bottom: 5px; color: #8696a0; font-size: 12px; }
.bc-wa-text { font-size: 13.5px; line-height: 1.45; color: #e9edef; white-space: pre-wrap; word-break: break-word; }
.bc-wa-time { display: block; text-align: right; font-size: 10px; color: #8696a0; margin-top: 2px; }
.bc-wa-empty { font-size: 12.5px; color: #8696a0; text-align: center; margin-top: 30px; font-style: italic; }
@media (max-width: 900px) {
  .bc-layout { flex-direction: column; }
  .bc-side { flex: none; width: 100%; max-width: 100%; position: static; height: 70vh; justify-content: center; }
  .bc-main { flex: none; width: 100%; }
}
.bc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.bc-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bc-title { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 700; color: var(--text); }
.bc-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
.bc-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.bc-back { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--surface3); color: var(--text2); flex-shrink: 0; }
.bc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
.bc-btn.sm { padding: 6px 10px; font-size: 12px; }
.bc-btn.primary { background: var(--primary); color: var(--on-primary); }
.bc-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
.bc-btn.ghost { background: var(--surface3); color: var(--text2); }
.bc-btn.warn { background: #d08b28; color: #fff; }
.bc-btn.danger { background: var(--danger, #e53e3e); color: #fff; }
.bc-notice { display: flex; gap: 8px; align-items: flex-start; background: var(--primary-light); color: var(--text2); padding: 11px 13px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; margin-bottom: 16px; }
.bc-notice svg { flex-shrink: 0; margin-top: 1px; color: var(--primary); }
.bc-empty { text-align: center; color: var(--muted); padding: 40px 0; font-size: 13.5px; }
.bc-list { display: flex; flex-direction: column; gap: 10px; }
.bc-card { text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; cursor: pointer; transition: all .15s; }
.bc-card:hover { border-color: var(--primary); }
.bc-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bc-card-name { font-size: 14.5px; font-weight: 700; color: var(--text); }
.bc-card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin: 6px 0 10px; flex-wrap: wrap; }
.bc-status { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.bc-status.draft { background: var(--surface3); color: var(--text2); }
.bc-status.scheduled { background: #e8f0fe; color: #1a56db; }
.bc-status.running { background: #e6f7ef; color: #128a5a; }
.bc-status.paused { background: #fdf0dc; color: #b57414; }
.bc-status.completed { background: var(--surface3); color: var(--text2); }
.bc-status.canceled { background: #fde8e8; color: #c53030; }
.bc-progress { height: 6px; border-radius: 999px; background: var(--surface3); overflow: hidden; }
.bc-progress.lg { height: 9px; margin: 4px 0 14px; }
.bc-progress-bar { height: 100%; background: var(--primary); transition: width .4s; }
.bc-card-stats { display: flex; gap: 12px; font-size: 11.5px; margin-top: 8px; }
.bc-card-stats .ok { color: #128a5a; } .bc-card-stats .skip { color: var(--muted); } .bc-card-stats .fail { color: #c53030; }
.bc-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.bc-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; }
.bc-stat-num { display: block; font-size: 22px; font-weight: 800; color: var(--text); }
.bc-stat-lbl { font-size: 11px; color: var(--muted); }
.bc-stat.ok .bc-stat-num { color: #128a5a; } .bc-stat.skip .bc-stat-num { color: var(--text2); } .bc-stat.fail .bc-stat-num { color: #c53030; }
.bc-info-row { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-bottom: 16px; }
.bc-info-row span { display: inline-flex; align-items: center; gap: 5px; }
.bc-msg-preview { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 18px; }
.bc-msg-preview-lbl { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
.bc-msg-bubble { background: var(--primary-light); border-radius: 10px; padding: 11px 13px; font-size: 13.5px; color: var(--text); white-space: pre-wrap; line-height: 1.5; }
.bc-recip-head { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.bc-recip-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.bc-recip { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 13px; border-bottom: 1px solid var(--border); background: var(--surface); }
.bc-recip:last-child { border-bottom: none; }
.bc-recip-info { display: flex; flex-direction: column; min-width: 0; }
.bc-recip-name { font-size: 13px; font-weight: 600; color: var(--text); }
.bc-recip-phone { font-size: 11.5px; color: var(--muted); }
.bc-recip-status { font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.bc-recip-status.sent { color: #128a5a; } .bc-recip-status.pending { color: var(--muted); }
.bc-recip-status.skipped { color: #b57414; } .bc-recip-status.failed { color: #c53030; }
.bc-steps { display: flex; gap: 8px; margin-bottom: 18px; }
.bc-step { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--muted); flex: 1; }
.bc-step-num { width: 22px; height: 22px; border-radius: 999px; background: var(--surface3); color: var(--text2); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.bc-step.active { color: var(--text); } .bc-step.active .bc-step-num { background: var(--primary); color: var(--on-primary); }
.bc-step.done .bc-step-num { background: #128a5a; color: #fff; }
.bc-form { display: flex; flex-direction: column; gap: 16px; }
.bc-field { display: flex; flex-direction: column; gap: 6px; }
.bc-field > label { font-size: 12.5px; font-weight: 600; color: var(--text2); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bc-hint { font-size: 11.5px; color: var(--muted); font-weight: 400; }
.bc-hint code { background: var(--surface3); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
.bc-field input, .bc-field textarea, .bc-field select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 9px; font-size: 13.5px; background: var(--surface); color: var(--text); font-family: inherit; }
.bc-field textarea { resize: vertical; }
.bc-tpl-list { display: flex; flex-direction: column; gap: 8px; }
.bc-tpl-item { display: flex; align-items: center; gap: 12px; text-align: left; padding: 11px 13px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface); cursor: pointer; transition: all .15s; }
.bc-tpl-item.sel { border-color: var(--primary); background: var(--primary-light); }
.bc-tpl-thumb { width: 42px; height: 42px; border-radius: 8px; background: var(--surface3); display: flex; align-items: center; justify-content: center; color: var(--muted); flex-shrink: 0; overflow: hidden; }
.bc-tpl-thumb img { width: 100%; height: 100%; object-fit: cover; }
.bc-tpl-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.bc-tpl-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
.bc-tpl-body { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bc-tpl-check { color: var(--primary); flex-shrink: 0; }
.bc-mode-tabs { display: flex; gap: 8px; }
.bc-mode-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; background: var(--surface3); color: var(--text2); }
.bc-mode-tabs button.active { background: var(--primary); color: var(--on-primary); }
.bc-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.bc-media-item { border: 2px solid var(--border); border-radius: 10px; overflow: hidden; cursor: pointer; background: var(--surface); display: flex; flex-direction: column; }
.bc-media-item.sel { border-color: var(--primary); }
.bc-media-item img { width: 100%; height: 80px; object-fit: cover; }
.bc-media-doc { height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--muted); font-size: 11px; }
.bc-media-label { font-size: 11px; padding: 6px; color: var(--text2); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bc-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.bc-form-actions.between { justify-content: space-between; }
.bc-recip-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bc-search { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 160px; padding: 8px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--muted); }
.bc-search input { border: none; outline: none; background: transparent; font-size: 13px; color: var(--text); width: 100%; }
.bc-cand-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; max-height: 46vh; overflow-y: auto; }
.bc-cand { display: flex; align-items: center; gap: 10px; padding: 10px 13px; border-bottom: 1px solid var(--border); background: var(--surface); cursor: pointer; }
.bc-cand:last-child { border-bottom: none; }
.bc-cand.disabled { opacity: .6; cursor: not-allowed; }
.bc-cand input { width: 17px; height: 17px; flex-shrink: 0; accent-color: var(--primary); }
.bc-cand-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.bc-cand-name { font-size: 13px; font-weight: 600; color: var(--text); }
.bc-cand-phone { font-size: 11.5px; color: var(--muted); }
.bc-cand-cd { font-size: 11px; color: #b57414; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.bc-cand-ok { font-size: 11px; color: #128a5a; flex-shrink: 0; }
.bc-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.bc-summary { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 9px; }
.bc-summary > div { display: flex; justify-content: space-between; font-size: 13px; }
.bc-summary span { color: var(--muted); } .bc-summary b { color: var(--text); }
@media (max-width: 600px) {
  .bc-detail-grid { grid-template-columns: repeat(2, 1fr); }
  .bc-review-grid { grid-template-columns: 1fr; }
  .bc-header { flex-direction: column; }
}
`

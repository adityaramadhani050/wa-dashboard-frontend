import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Megaphone, ArrowLeft, Search, Send, Clock, Users, Image as ImageIcon,
  Play, Pause, X, CheckCircle2, AlertCircle, RefreshCw, Calendar, MessageSquareText, Trash2, MapPin, Plus, ShieldCheck,
} from 'lucide-react'
import PdfThumb, { isPdf } from '../components/PdfThumb'
import {
  getBroadcastCandidates, getBroadcastCampaigns, getBroadcastCampaign,
  createBroadcastCampaign, startBroadcastCampaign, pauseBroadcastCampaign,
  cancelBroadcastCampaign, deleteBroadcastCampaign, getBroadcastTemplates,
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
                  : isPdf(null, mediaUrl)
                    ? <div className="bc-wa-pdf"><PdfThumb url={mediaUrl} /></div>
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
          <h1 className="bc-title"><Megaphone size={21} /> Broadcast Promo{!loading && <span className="bc-count">{campaigns.length}</span>}</h1>
        </div>
        <div className="bc-header-actions">
          <button className="bc-btn ghost icon" onClick={onReload} title="Muat ulang" aria-label="Muat ulang"><RefreshCw size={16} /></button>
          <button className="bc-btn primary bc-new-btn" onClick={onNew}><Plus size={16} /><span className="bc-hide-xs">Buat Broadcast</span></button>
        </div>
      </div>

      <div className="bc-notice">
        <ShieldCheck size={16} />
        <span>Demi keamanan akun WhatsApp: pengiriman bertahap dengan jeda acak, dibatasi per hari, hanya di jam kerja, dan setiap nomor punya masa jeda (cooldown) agar tidak spam.</span>
      </div>

      {loading ? (
        <div className="bc-list">{[...Array(3)].map((_, i) => <div key={i} className="bc-skel" style={{ animationDelay: `${i * 0.08}s` }} />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="bc-empty-box">
          <Megaphone size={34} strokeWidth={1.4} />
          <p>Belum ada campaign broadcast.</p>
          <button className="bc-btn primary" onClick={onNew}><Plus size={16} /> Buat Broadcast</button>
        </div>
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
                  <span>{c.media_url || c.message_type === 'quick_media' ? <><ImageIcon size={13} /> Media</> : <><MessageSquareText size={13} /> Teks</>}</span>
                  <span><Users size={13} /> {c.total_targets} target</span>
                  {c.status === 'scheduled' && c.start_at && <span><Calendar size={13} /> {fmtDate(c.start_at)}</span>}
                </div>
                <div className="bc-progress-row">
                  <div className="bc-progress"><div className="bc-progress-bar" style={{ width: `${pct}%` }} /></div>
                  <span className="bc-pct">{pct}%</span>
                </div>
                <div className="bc-card-stats">
                  <span className="ok"><b>{c.sent_count || 0}</b> terkirim</span>
                  <span className="skip"><b>{c.skipped_count || 0}</b> dilewati</span>
                  <span className="fail"><b>{c.failed_count || 0}</b> gagal</span>
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
          <div className="bc-title-col">
            <h1 className="bc-title">{c.name}</h1>
            <span className={`bc-status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
          </div>
        </div>
        <div className="bc-header-actions wrap">
          {(c.status === 'draft' || c.status === 'paused' || c.status === 'scheduled') && (
            <button className="bc-btn primary" disabled={busy} onClick={() => act(startBroadcastCampaign)}><Play size={15} /> Mulai Sekarang</button>
          )}
          {c.status === 'running' && (
            <button className="bc-btn warn" disabled={busy} onClick={() => act(pauseBroadcastCampaign)}><Pause size={15} /> Jeda</button>
          )}
          {['draft', 'scheduled', 'running', 'paused'].includes(c.status) && (
            <button className="bc-btn outline" disabled={busy} onClick={() => { if (confirm('Batalkan campaign ini?')) act(cancelBroadcastCampaign) }}><X size={15} /> Batalkan</button>
          )}
          {c.status !== 'running' && (
            <button className="bc-btn danger" disabled={busy} onClick={async () => {
              if (!confirm('Hapus campaign ini secara permanen? Data penerima ikut terhapus.')) return
              setBusy(true)
              try { await deleteBroadcastCampaign(id); onChanged?.(); onBack() }
              catch (e) { alert(e?.response?.data?.error || 'Gagal menghapus'); setBusy(false) }
            }}><Trash2 size={15} /> Hapus</button>
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
        <span className="bc-info-pct">{pct}% selesai</span>
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
  const [name, setName] = useState('')
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState(null)

  const [cooldownDays, setCooldownDays] = useState(14)
  const [dailyLimit, setDailyLimit] = useState(40)
  const [startAt, setStartAt] = useState('')

  const [candidates, setCandidates] = useState([])
  const [loadingCand, setLoadingCand] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all') // all | barat | timur | none
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

  // Muat kandidat (mengikuti cooldown yang dipilih)
  useEffect(() => { loadCandidates(cooldownDays) }, [cooldownDays, loadCandidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (regionFilter === 'none' ? !!c.region : regionFilter !== 'all' && c.region !== regionFilter) return false
      if (!q) return true
      return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.city || '').toLowerCase().includes(q)
    })
  }, [candidates, search, regionFilter])

  const regionCount = (key) => key === 'all' ? candidates.length
    : candidates.filter(c => key === 'none' ? !c.region : c.region === key).length

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
      if (startAt) payload.start_at = new Date(startAt).toISOString()
      const { campaign } = await createBroadcastCampaign(payload)
      // Tanpa jadwal -> mulai sekarang juga
      if (!startAt) { try { await startBroadcastCampaign(campaign.id) } catch {} }
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
          <h1 className="bc-title">Buat Broadcast</h1>
        </div>
      </div>

      <div className="bc-layout">
       <div className="bc-main">
        <div className="bc-form">
          <section className="bc-section">
          <div className="bc-section-title"><span className="bc-step-num">1</span> Pesan</div>
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

          </section>

          <section className="bc-section">
          <div className="bc-section-title"><span className="bc-step-num">2</span> Pengaturan kirim</div>
          <div className="bc-review-grid">
            <div className="bc-field">
              <label>Batas per hari</label>
              <input type="number" min={1} max={500} value={dailyLimit} onChange={e => setDailyLimit(Math.max(1, parseInt(e.target.value) || 40))} />
              <span className="bc-hint">Disarankan mulai 40/hari, naikkan bertahap.</span>
            </div>
            <div className="bc-field">
              <label>Cooldown (hari)</label>
              <input type="number" min={1} max={365} value={cooldownDays} onChange={e => setCooldownDays(Math.max(1, parseInt(e.target.value) || 14))} />
              <span className="bc-hint">Jeda minimum sebelum satu nomor boleh dikirim lagi.</span>
            </div>
          </div>

          <div className="bc-field">
            <label>Waktu Mulai</label>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            <span className="bc-hint">Kosongkan untuk mulai hari ini.</span>
          </div>
          </section>

          <section className="bc-section">
          <div className="bc-section-title"><span className="bc-step-num">3</span> Penerima <span className="bc-chosen">{chosen.length} dipilih</span></div>
          <div className="bc-field">
            <span className="bc-hint">Chat <b>Resolved</b> (bukan Non-Client). Nomor yang masih dalam masa cooldown tidak bisa dipilih.</span>
            <div className="bc-seg">
              {[['all', 'Semua'], ['barat', 'Barat'], ['timur', 'Timur'], ['none', 'Belum diatur']].map(([k, l]) => (
                <button key={k} type="button" className={`${k}${regionFilter === k ? ' active' : ''}`} onClick={() => setRegionFilter(k)}>
                  {k !== 'all' && k !== 'none' && <MapPin size={11} />}{l}<span className="bc-region-count">{regionCount(k)}</span>
                </button>
              ))}
            </div>
            <div className="bc-recip-toolbar">
              <div className="bc-search">
                <Search size={15} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor / kota…" />
              </div>
              <button type="button" className="bc-btn ghost sm" onClick={selectableAll}>Pilih semua</button>
              <button type="button" className="bc-btn ghost sm" onClick={clearAll} disabled={!selected.size}>Kosongkan</button>
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
                      <span className="bc-cand-phone">{c.phone}{c.city ? ` · ${c.city}` : ''}</span>
                    </div>
                    {c.region && <span className={`bc-cand-region ${c.region}`}>{c.region === 'barat' ? 'Barat' : 'Timur'}</span>}
                    {c.on_cooldown
                      ? <span className="bc-cand-cd"><Clock size={12} /> cooldown s/d {fmtDate(c.cooldown_until)}</span>
                      : <span className="bc-cand-ok">boleh</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          </section>

          <div className="bc-summary">
            <div><span>Template</span><b>{template?.name || '-'}</b></div>
            <div><span>Penerima</span><b>{chosen.length} nomor</b></div>
            <div><span>Estimasi durasi</span><b>{estDays} hari (≈{dailyLimit}/hari)</b></div>
            <div><span>Mulai</span><b>{startAt ? fmtDate(startAt) : 'Hari ini'}</b></div>
          </div>

          <div className="bc-form-actions between">
            <button type="button" className="bc-btn ghost" onClick={onBack}>Batal</button>
            <button type="button" className="bc-btn primary"
              disabled={submitting || !name.trim() || !templateId || chosen.length === 0}
              onClick={submit}>
              <Send size={15} /> {submitting ? 'Menyimpan…' : startAt ? 'Buat & Jadwalkan' : 'Buat & Mulai'}
            </button>
          </div>
        </div>
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
.bc-wa-pdf { width: 100%; max-height: 260px; overflow: hidden; border-radius: 5px; margin-bottom: 5px; background: #fff; }
.bc-wa-pdf img { width: 100%; height: auto; display: block; }
.bc-wa-text { font-size: 13.5px; line-height: 1.45; color: #e9edef; white-space: pre-wrap; word-break: break-word; }
.bc-wa-time { display: block; text-align: right; font-size: 10px; color: #8696a0; margin-top: 2px; }
.bc-wa-empty { font-size: 12.5px; color: #8696a0; text-align: center; margin-top: 30px; font-style: italic; }
@media (max-width: 900px) {
  .bc-layout { flex-direction: column; }
  .bc-side { flex: none; width: 100%; max-width: 100%; position: static; height: 70vh; justify-content: center; }
  .bc-main { flex: none; width: 100%; }
}
.bc-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 38px; }
.bc-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bc-title-col { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.bc-title { display: flex; align-items: center; gap: 9px; font-size: 21px; font-weight: 700; color: var(--text); min-width: 0; overflow-wrap: anywhere; }
.bc-count { font-size: 11.5px; font-weight: 700; color: var(--text2); background: var(--surface); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
.bc-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.bc-header-actions.wrap { flex-wrap: wrap; justify-content: flex-end; }
.bc-back { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--border); color: var(--text2); flex-shrink: 0; }
.bc-back:hover { background: var(--surface2); }
.bc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap; }
.bc-btn.icon { width: 38px; padding: 0; }
.bc-btn.sm { height: 34px; padding: 0 12px; font-size: 12.5px; }
.bc-btn.primary { background: var(--primary); color: var(--on-primary); }
.bc-btn.primary:hover:not(:disabled) { background: var(--primary-hover); }
.bc-btn:disabled { opacity: .5; cursor: not-allowed; }
.bc-btn.ghost { background: var(--surface); color: var(--text2); border: 1px solid var(--border); }
.bc-btn.ghost:hover:not(:disabled) { background: var(--surface2); border-color: var(--border2); }
.bc-btn.warn { background: rgba(208,139,40,0.14); color: #d08b28; border: 1px solid rgba(208,139,40,0.35); }
.bc-btn.outline { background: var(--surface); color: var(--text2); border: 1px solid var(--border2); }
.bc-btn.danger { background: rgba(229,62,62,0.1); color: var(--danger, #e53e3e); border: 1px solid rgba(229,62,62,0.3); }
.bc-btn.danger:hover:not(:disabled) { background: rgba(229,62,62,0.16); }
.bc-notice { display: flex; gap: 9px; align-items: flex-start; background: var(--primary-light); color: var(--text2); padding: 11px 14px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; margin-bottom: 16px; }
.bc-notice svg { flex-shrink: 0; margin-top: 1px; color: var(--primary); }
.bc-empty { text-align: center; color: var(--muted); padding: 32px 0; font-size: 13.5px; }
.bc-empty-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 56px 20px; color: var(--muted); font-size: 13.5px; background: var(--surface); border: 1px dashed var(--border2); border-radius: 12px; }
.bc-skel { height: 132px; border-radius: 12px; background: var(--skeleton); animation: bcPulse 1.4s ease infinite; }
@keyframes bcPulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
.bc-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.bc-card { display: flex; flex-direction: column; gap: 10px; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: border-color .15s, box-shadow .15s; box-shadow: 0 1px 3px var(--shadow); }
.bc-card:hover { border-color: var(--primary); }
.bc-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.bc-card-name { font-size: 14.5px; font-weight: 700; color: var(--text); }
.bc-card-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.bc-card-meta span { display: inline-flex; align-items: center; gap: 5px; }
.bc-status { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
.bc-status.draft, .bc-status.completed { background: var(--surface3); color: var(--text2); }
.bc-status.scheduled { background: rgba(37,99,235,0.14); color: #3b82f6; }
.bc-status.running { background: rgba(16,185,129,0.14); color: #10b981; }
.bc-status.paused { background: rgba(208,139,40,0.15); color: #d08b28; }
.bc-status.canceled { background: rgba(229,62,62,0.12); color: var(--danger, #e53e3e); }
.bc-progress-row { display: flex; align-items: center; gap: 10px; }
.bc-progress { flex: 1; height: 7px; border-radius: 999px; background: var(--surface3); overflow: hidden; }
.bc-progress.lg { height: 9px; margin: 4px 0 14px; }
.bc-progress-bar { height: 100%; background: var(--primary); border-radius: 999px; transition: width .4s; }
.bc-pct { font-size: 12px; font-weight: 700; color: var(--text2); min-width: 34px; text-align: right; }
.bc-card-stats { display: flex; gap: 14px; font-size: 12px; color: var(--muted); }
.bc-card-stats b { font-weight: 700; }
.bc-card-stats .ok b { color: #10b981; } .bc-card-stats .fail b { color: var(--danger, #e53e3e); } .bc-card-stats .skip b { color: var(--text2); }
.bc-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.bc-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 3px var(--shadow); }
.bc-stat-num { display: block; font-size: 24px; font-weight: 800; color: var(--text); line-height: 1.15; }
.bc-stat-lbl { font-size: 11.5px; font-weight: 600; color: var(--muted); }
.bc-stat.ok .bc-stat-num { color: #10b981; } .bc-stat.skip .bc-stat-num { color: var(--text2); } .bc-stat.fail .bc-stat-num { color: var(--danger, #e53e3e); }
.bc-info-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 16px; }
.bc-info-row span { display: inline-flex; align-items: center; gap: 5px; }
.bc-info-pct { margin-left: auto; font-weight: 700; color: var(--text2); }
.bc-recip-head { font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.bc-recip-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.bc-recip { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
.bc-recip:last-child { border-bottom: none; }
.bc-recip-info { display: flex; flex-direction: column; min-width: 0; }
.bc-recip-name { font-size: 13px; font-weight: 600; color: var(--text); }
.bc-recip-phone { font-size: 11.5px; color: var(--muted); }
.bc-recip-status { font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 2px 8px; border-radius: 999px; }
.bc-recip-status.sent { color: #10b981; background: rgba(16,185,129,0.12); } .bc-recip-status.pending { color: var(--muted); background: var(--surface3); }
.bc-recip-status.skipped { color: #d08b28; background: rgba(208,139,40,0.12); } .bc-recip-status.failed { color: var(--danger, #e53e3e); background: rgba(229,62,62,0.1); }
.bc-form { display: flex; flex-direction: column; gap: 14px; }
.bc-section { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 1px 3px var(--shadow); }
.bc-section-title { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 700; color: var(--text); }
.bc-step-num { width: 22px; height: 22px; border-radius: 999px; background: var(--primary); color: var(--on-primary); display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; }
.bc-chosen { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 2px 9px; border-radius: 999px; }
.bc-field { display: flex; flex-direction: column; gap: 6px; }
.bc-field > label { font-size: 12.5px; font-weight: 600; color: var(--text2); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bc-hint { font-size: 11.5px; color: var(--muted); font-weight: 400; line-height: 1.45; }
.bc-hint b { color: var(--text2); }
.bc-hint code { background: var(--surface3); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
.bc-field input, .bc-field textarea, .bc-field select { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 9px; font-size: 13.5px; background: var(--surface2); color: var(--text); font-family: inherit; outline: none; transition: border-color .15s; }
.bc-field textarea { height: auto; padding: 10px 12px; resize: vertical; }
.bc-field input:focus, .bc-field select:focus, .bc-field textarea:focus { border-color: var(--primary); background: var(--surface); }
.bc-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.bc-form-actions.between { justify-content: space-between; }
.bc-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); margin-bottom: 8px; }
.bc-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 32px; padding: 0 8px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--text2); white-space: nowrap; }
.bc-seg button:hover:not(.active) { background: var(--surface3); }
.bc-seg button.active { background: var(--primary); color: var(--on-primary); }
.bc-seg button.barat.active { background: #2563eb; } .bc-seg button.timur.active { background: #d97706; }
.bc-region-count { font-size: 10.5px; font-weight: 700; padding: 0 6px; border-radius: 999px; background: var(--surface3); color: var(--text2); }
.bc-seg button.active .bc-region-count { background: rgba(255,255,255,0.25); color: #fff; }
.bc-recip-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bc-search { display: flex; align-items: center; gap: 7px; flex: 1 1 200px; min-width: 140px; height: 38px; padding: 0 11px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface2); color: var(--muted); box-sizing: border-box; }
.bc-search:focus-within { border-color: var(--primary); }
.bc-search input { border: none; outline: none; background: transparent; font-size: 13px; color: var(--text); width: 100%; height: auto; padding: 0; }
.bc-cand-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; max-height: 46vh; overflow-y: auto; }
.bc-cand { display: flex; align-items: center; gap: 10px; padding: 10px 13px; border-bottom: 1px solid var(--border); background: var(--surface); cursor: pointer; transition: background .1s; }
.bc-cand:hover:not(.disabled) { background: var(--surface2); }
.bc-cand:last-child { border-bottom: none; }
.bc-cand.disabled { opacity: .6; cursor: not-allowed; }
.bc-cand input { width: 17px !important; height: 17px !important; flex-shrink: 0; accent-color: var(--primary); }
.bc-cand-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.bc-cand-name { font-size: 13px; font-weight: 600; color: var(--text); }
.bc-cand-phone { font-size: 11.5px; color: var(--muted); }
.bc-cand-region { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
.bc-cand-region.barat { color: #3b82f6; background: rgba(37,99,235,0.13); }
.bc-cand-region.timur { color: #d97706; background: rgba(217,119,6,0.13); }
.bc-cand-cd { font-size: 11px; color: #d08b28; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.bc-cand-ok { font-size: 11px; font-weight: 600; color: #10b981; flex-shrink: 0; }
.bc-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.bc-summary { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 9px; box-shadow: 0 1px 3px var(--shadow); }
.bc-summary > div { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.bc-summary span { color: var(--muted); } .bc-summary b { color: var(--text); text-align: right; }
.bc-hide-xs { display: inline; }
@media (max-width: 760px) {
  .bc-page { padding: 16px 14px 32px; }
  .bc-list { grid-template-columns: 1fr; }
  .bc-header { flex-wrap: wrap; }
  .bc-header-actions.wrap { width: 100%; justify-content: flex-start; }
  .bc-side { height: auto !important; max-height: 560px; }
  .bc-phone { height: 520px; }
}
@media (max-width: 600px) {
  .bc-detail-grid { grid-template-columns: repeat(2, 1fr); }
  .bc-review-grid { grid-template-columns: 1fr; }
}
@media (max-width: 420px) { .bc-hide-xs { display: none; } .bc-new-btn { width: 38px; padding: 0; } }
`

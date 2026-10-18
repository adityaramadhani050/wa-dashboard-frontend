import { useEffect, useMemo, useState } from 'react'
import { Cpu, AlertTriangle, CheckCircle2, Play, Plus, X, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { getAiModels, saveAiModels, getOpenRouterModels, getOpenRouterStatus, testAiModel } from '../hooks/useApi'

// Model AI (OpenRouter) per fitur: Manajemen Agent → AI Sales → Model AI.
const GROUPS = [
  {
    title: 'Chat dengan customer',
    desc: 'Butuh bahasa Indonesia yang natural. Pilih model terbaik yang Anda punya.',
    features: [
      ['ai_sales_reply', 'AI Sales — balas customer', 'Balasan otomatis akun AI Sales'],
      ['ai_followup', 'AI Sales — follow-up otomatis', 'Pesan follow-up yang dikirim AI'],
      ['suggest_reply', 'Saran balasan (agent)', 'Tombol saran balasan di layar chat'],
      ['followup_draft', 'Draf follow-up (agent)', 'Draf pesan di menu Follow-up'],
      ['ai_team_reply', 'AI Sales — teruskan jawaban tim', 'Menyampaikan jawaban Tanya Tim ke customer'],
    ],
  },
  {
    title: 'Tugas latar',
    desc: 'Tugas ringan, cukup model yang cepat & murah.',
    features: [
      ['memory_summary', 'Ringkasan Ingatan AI', 'Merangkum fakta customer'],
      ['skill_keywords', 'Saran kata kunci skill', 'Saat menyimpan skill tanpa kata kunci'],
      ['regional_city', 'Deteksi kota (bot regional)', 'Bila kota tidak ada di kamus'],
      ['team_parse', 'Tanya Tim — membaca jawaban tim', 'Memahami balasan PIC (stok, pertanyaan balik)'],
    ],
  },
]

const errMsg = (e, f) => e?.response?.data?.error || f
const usd = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const priceLabel = (m) => m.free ? 'gratis' : `$${m.price_in.toFixed(2)} / $${m.price_out.toFixed(2)} per 1jt token`

function ModelInput({ value, onChange, catalog, placeholder }) {
  const known = !value || !catalog || catalog.has(value)
  const info = catalog?.get(value)
  return (
    <div className="mm-input-wrap">
      <input list="mm-models" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />
      {value && info && <span className={`mm-tag${info.free ? ' free' : ''}`}>{info.free ? 'gratis' : 'berbayar'}</span>}
      {!known && <span className="mm-tag warn" title="ID ini tidak ada di daftar model OpenRouter saat ini">tidak ditemukan</span>}
    </div>
  )
}

export default function AiModelsPanel() {
  const [cfg, setCfg] = useState(null)
  const [saved, setSaved] = useState(null)
  const [models, setModels] = useState(null)
  const [modelsErr, setModelsErr] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [tests, setTests] = useState({})

  const loadModels = () => {
    setModelsErr('')
    getOpenRouterModels().then(d => setModels(d.models || [])).catch(e => setModelsErr(errMsg(e, 'Gagal memuat daftar model')))
  }
  useEffect(() => {
    getAiModels().then(d => { setCfg(d); setSaved(JSON.stringify(d)) }).catch(e => setError(errMsg(e, 'Gagal memuat pengaturan model')))
    getOpenRouterStatus().then(setStatus).catch(() => setStatus(null))
    loadModels()
  }, [])

  const catalog = useMemo(() => models ? new Map(models.map(m => [m.id, m])) : null, [models])
  const dirty = cfg && saved !== JSON.stringify(cfg)

  const setFeature = (key, patch) => setCfg(c => ({ ...c, features: { ...c.features, [key]: { ...c.features[key], ...patch } } }))
  const setFallback = (key, i, v) => setFeature(key, { fallbacks: cfg.features[key].fallbacks.map((x, j) => j === i ? v : x) })
  const applyGroup = (group, from) => {
    const src = cfg.features[from]
    setCfg(c => ({ ...c, features: { ...c.features, ...Object.fromEntries(group.features.map(([k]) => [k, { model: src.model, fallbacks: [...src.fallbacks] }])) } }))
  }

  const save = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const features = Object.fromEntries(Object.entries(cfg.features).map(([k, f]) => [k, { model: f.model.trim(), fallbacks: f.fallbacks.map(x => x.trim()).filter(Boolean) }]))
      const d = await saveAiModels({ features, privacy: cfg.privacy })
      setCfg(d); setSaved(JSON.stringify(d)); setNotice('Pengaturan model disimpan.')
      setTimeout(() => setNotice(''), 2500)
    } catch (e) { setError(errMsg(e, 'Gagal menyimpan')) }
    finally { setBusy(false) }
  }

  const runTest = async (key) => {
    const model = cfg.features[key].model.trim()
    if (!model) return
    setTests(t => ({ ...t, [key]: { loading: true } }))
    try {
      const r = await testAiModel({ model, feature: key })
      setTests(t => ({ ...t, [key]: r }))
    }
    catch (e) { setTests(t => ({ ...t, [key]: { ok: false, error: errMsg(e, 'Tes gagal') } })) }
  }

  if (error && !cfg) return <div className="ak-section"><div className="rr-warn"><AlertTriangle size={14} /> {error}</div></div>
  if (!cfg) return <div className="ak-section"><div className="ak-empty">Memuat…</div></div>

  return (
    <div className="ak-section">
      <div className="ak-head">
        <div>
          <div className="aa-title">Model AI per Fitur</div>
          <div className="aa-desc">Semua fitur AI memakai <b>OpenRouter</b>. Setiap fitur punya model utama & cadangan: bila model utama error, kena limit, atau jawabannya kosong, cadangan dipakai berurutan. Model gratis berakhiran <code>:free</code> dan daftarnya sering berganti, pakai tombol Tes sebelum menyimpan.</div>
        </div>
        <div className="ak-head-actions">
          <button className="am-btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>

      {cfg.ai_ready === false && <div className="rr-warn"><AlertTriangle size={14} /> OPENROUTER_API_KEY belum diset di server (Railway → Variables). Semua fitur AI tidak aktif.</div>}
      {status?.configured && status.valid === false && <div className="rr-warn"><AlertTriangle size={14} /> API key OpenRouter ditolak: {status.error || 'tidak valid'}.</div>}

      {status?.configured && status.valid && (
        <div className="mm-status">
          <div className="mm-stat">
            <Wallet size={16} />
            <div><span>Saldo kredit</span><b>{status.credits ? usd(status.credits.remaining) : '—'}</b></div>
          </div>
          <div className="mm-stat">
            <Cpu size={16} />
            <div><span>Batas model gratis</span><b>{status.free_daily_limit.toLocaleString('id-ID')} request/hari</b></div>
          </div>
          {status.free_tier && (
            <div className="rr-warn mm-tip"><AlertTriangle size={14} /> Akun belum pernah membeli kredit, jadi model gratis dibatasi 50 request/hari. Top-up minimal $10 sekali di openrouter.ai agar naik menjadi 1.000/hari; saldonya juga dipakai model cadangan berbayar.</div>
          )}
        </div>
      )}

      {modelsErr && <div className="rr-warn"><AlertTriangle size={14} /> {modelsErr} <button className="ak-link" onClick={loadModels}><RefreshCw size={12} /> Coba lagi</button></div>}
      <datalist id="mm-models">
        {(models || []).map(m => <option key={m.id} value={m.id}>{`${m.name} · ${priceLabel(m)}${m.context ? ` · ${Math.round(m.context / 1000)}K` : ''}`}</option>)}
      </datalist>

      {GROUPS.map(group => (
        <div key={group.title} className="mm-group">
          <div className="mm-group-head">
            <b>{group.title}</b>
            <span>{group.desc}</span>
          </div>
          {group.features.map(([key, label, desc], idx) => {
            const f = cfg.features[key]
            const t = tests[key]
            return (
              <div key={key} className="mm-row">
                <div className="mm-label">
                  <b>{label}</b>
                  <span>{desc}</span>
                  {idx === 0 && <button className="ak-link" onClick={() => applyGroup(group, key)}>Samakan ke semua di grup ini</button>}
                </div>
                <div className="mm-fields">
                  <div className="mm-line">
                    <small>Utama</small>
                    <ModelInput value={f.model} onChange={v => setFeature(key, { model: v })} catalog={catalog} placeholder="mis. google/gemma-4-31b-it:free" />
                    <button className="am-btn mm-test" onClick={() => runTest(key)} disabled={!f.model.trim() || t?.loading} title="Tes model utama dengan contoh chat customer"><Play size={13} />{t?.loading ? 'Tes…' : 'Tes'}</button>
                  </div>
                  {f.fallbacks.map((fb, i) => (
                    <div key={i} className="mm-line">
                      <small>Cadangan {i + 1}</small>
                      <ModelInput value={fb} onChange={v => setFallback(key, i, v)} catalog={catalog} placeholder="ID model cadangan" />
                      <button className="mm-icon" onClick={() => setFeature(key, { fallbacks: f.fallbacks.filter((_, j) => j !== i) })} aria-label="Hapus cadangan"><X size={15} /></button>
                    </div>
                  ))}
                  {f.fallbacks.length < 3 && <button className="ak-link mm-add" onClick={() => setFeature(key, { fallbacks: [...f.fallbacks, ''] })}><Plus size={12} /> Tambah cadangan</button>}
                  {t && !t.loading && (
                    t.ok
                      ? <div className="mm-result ok"><CheckCircle2 size={14} /><div><small>{t.model} · {(t.ms / 1000).toFixed(1)} dtk</small><p>{t.text}</p></div></div>
                      : <div className="mm-result bad"><AlertTriangle size={14} /><div><small>{t.model || f.model}</small><p>{t.error}</p></div></div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <label className="mm-privacy">
        <input type="checkbox" checked={!!cfg.privacy} onChange={e => setCfg(c => ({ ...c, privacy: e.target.checked }))} />
        <ShieldCheck size={16} />
        <div>
          <b>Hanya penyedia yang tidak menyimpan data</b>
          <span>Isi chat customer tidak dipakai untuk melatih model. Sebagian model gratis tidak tersedia bila opsi ini aktif, sehingga cadangan lebih sering dipakai.</span>
        </div>
      </label>

      {error && <div className="rr-warn"><AlertTriangle size={14} /> {error}</div>}
      {notice && <div className="mm-notice"><CheckCircle2 size={14} /> {notice}</div>}

      <style>{`
        .mm-status { display: flex; flex-wrap: wrap; gap: 10px; }
        .mm-stat { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); color: #8b5cf6; }
        .mm-stat div { display: flex; flex-direction: column; }
        .mm-stat span { font-size: 11.5px; color: var(--muted); font-weight: 600; }
        .mm-stat b { font-size: 15px; color: var(--text); }
        .mm-tip { flex-basis: 100%; }
        .mm-group { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .mm-group-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 10px 14px; background: var(--surface2); border-bottom: 1px solid var(--border); }
        .mm-group-head b { font-size: 13px; color: var(--text); }
        .mm-group-head span { font-size: 12px; color: var(--muted); }
        .mm-row { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 14px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .mm-row:last-child { border-bottom: none; }
        .mm-label { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .mm-label b { font-size: 13px; color: var(--text); }
        .mm-label span { font-size: 12px; color: var(--muted); line-height: 1.4; }
        .mm-label .ak-link { align-self: flex-start; margin-top: 4px; font-size: 12px; }
        .mm-fields { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .mm-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .mm-line > small { width: 74px; flex-shrink: 0; font-size: 11.5px; color: var(--muted); font-weight: 600; }
        .mm-input-wrap { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 8px 0 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface2); }
        .mm-input-wrap:focus-within { border-color: var(--primary); background: var(--surface); }
        .mm-input-wrap input { flex: 1; min-width: 0; height: 100%; border: none; background: none; outline: none; color: var(--text); font-size: 12.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .mm-tag { flex-shrink: 0; padding: 2px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700; background: var(--surface3); color: var(--text2); }
        .mm-tag.free { background: rgba(56,161,105,0.14); color: var(--success); }
        .mm-tag.warn { background: rgba(208,139,40,0.14); color: var(--warning, #d08b28); }
        .mm-test { height: 36px; padding: 0 12px; flex-shrink: 0; }
        .mm-icon { width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 9px; color: var(--muted); }
        .mm-icon:hover { background: var(--surface3); color: var(--danger); }
        .mm-add { align-self: flex-start; margin-left: 82px; font-size: 12px; }
        .mm-result { display: flex; gap: 8px; padding: 8px 10px; border-radius: 9px; font-size: 12.5px; margin-left: 82px; }
        .mm-result svg { flex-shrink: 0; margin-top: 2px; }
        .mm-result small { color: var(--muted); font-size: 11px; }
        .mm-result p { color: var(--text); line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .mm-result.ok { background: rgba(56,161,105,0.08); border: 1px solid rgba(56,161,105,0.25); color: var(--success); }
        .mm-result.bad { background: rgba(229,62,62,0.07); border: 1px solid rgba(229,62,62,0.25); color: var(--danger); }
        .mm-privacy { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; cursor: pointer; color: #8b5cf6; }
        .mm-privacy input { margin-top: 3px; accent-color: var(--primary); }
        .mm-privacy svg { flex-shrink: 0; margin-top: 1px; }
        .mm-privacy div { display: flex; flex-direction: column; gap: 2px; }
        .mm-privacy b { font-size: 13px; color: var(--text); }
        .mm-privacy span { font-size: 12px; color: var(--muted); line-height: 1.45; }
        .mm-notice { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--success); }
        .ak-section code { font-size: 11.5px; padding: 1px 5px; border-radius: 5px; background: var(--surface3); }
        @media (max-width: 768px) {
          .mm-row { grid-template-columns: 1fr; gap: 8px; }
          .mm-line { flex-wrap: wrap; gap: 4px 8px; }
          .mm-line > small { width: 100%; }
          .mm-add, .mm-result { margin-left: 0; }
        }
      `}</style>
    </div>
  )
}

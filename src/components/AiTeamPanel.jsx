import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, X, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, PhoneCall, RefreshCw, Package, Truck, Wrench } from 'lucide-react'
import { getAiTeam, saveAiTeam, getTeamRequests, closeTeamRequest, checkTeamNumbers } from '../hooks/useApi'

// Tanya Tim: Manajemen Agent → AI Sales → Tanya Tim.
const DIVS = [
  { key: 'gudang', label: 'Gudang', icon: Package, desc: 'Cek stok fisik yang ada sekarang. Semua pertanyaan stok/ketersediaan barang ditanyakan ke sini dulu.' },
  { key: 'procurement', label: 'Procurement', icon: Truck, desc: 'Otomatis ditanya bila gudang menjawab kosong/sebagian: ketersediaan, lama pemesanan & pengiriman. Ke customer disampaikan sebagai pesanan dari pabrik.' },
  { key: 'teknis', label: 'Teknis / Engineer', icon: Wrench, desc: 'Pertanyaan teknis: atap, kelistrikan, kompatibilitas, beban, error inverter.' },
]
const STATUS = {
  open: ['Menunggu tim', 'wait'], waiting_customer: ['Tim butuh info customer', 'ask'], answered: ['Terjawab', 'ok'],
  closed: ['Ditutup', 'off'], expired: ['Kedaluwarsa', 'off'], failed: ['Gagal dikirim', 'bad'],
}
export const teamStatus = (s) => STATUS[s] || [s, 'off']
const errMsg = (e, f) => e?.response?.data?.error || f
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

function RequestList({ onOpenChat }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = () => getTeamRequests({ limit: 30 }).then(d => { setData(d); setError('') }).catch(e => setError(errMsg(e, 'Gagal memuat riwayat')))
  useEffect(() => { load() }, [])
  const close = async (id) => { try { await closeTeamRequest(id); load() } catch (e) { setError(errMsg(e, 'Gagal menutup')) } }

  return (
    <div className="tt-hist">
      <div className="tt-hist-head">
        <b>Pertanyaan terbaru</b>
        <button className="ak-link" onClick={load}><RefreshCw size={12} /> Muat ulang</button>
      </div>
      {error && <div className="rr-warn"><AlertTriangle size={14} /> {error}</div>}
      {data && !data.ready && <div className="rr-warn"><AlertTriangle size={14} /> Tabel ai_team_requests belum dibuat. Jalankan SQL migrasi di Supabase.</div>}
      {data?.ready && !data.requests.length && <div className="ak-empty">Belum ada pertanyaan ke tim.</div>}
      {data?.requests?.map(r => {
        const [label, tone] = teamStatus(r.status)
        const lastTeam = [...(r.thread || [])].reverse().find(t => t.from === 'team')
        return (
          <div key={r.id} className="tt-req">
            <div className="tt-req-top">
              <span className={`tt-div ${r.division}`}>{DIVS.find(d => d.key === r.division)?.label || r.division}</span>
              <b>{r.topic || r.customer_question}</b>
              <span className={`tt-st ${tone}`}>{label}</span>
            </div>
            <div className="tt-req-meta">
              <button className="ak-link" onClick={() => onOpenChat?.(r.conversation_id)}>{r.conversation?.contact?.name || r.conversation?.contact?.phone || 'Chat'}</button>
              <span>· {fmtTime(r.created_at)}</span>
              {r.parent_id && <span>· lanjutan dari gudang</span>}
            </div>
            {(r.answer || lastTeam) && <div className="tt-ans">{r.answer || lastTeam.text}</div>}
            {['open', 'waiting_customer'].includes(r.status) && <button className="ak-link tt-close" onClick={() => close(r.id)}>Tutup pertanyaan</button>}
          </div>
        )
      })}
    </div>
  )
}

export default function AiTeamPanel() {
  const navigate = useNavigate()
  const onOpenChat = (id) => navigate(`/chat/${id}`)
  const [cfg, setCfg] = useState(null)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [check, setCheck] = useState(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    getAiTeam().then(d => { setCfg(d); setSaved(JSON.stringify(d)) }).catch(e => setError(errMsg(e, 'Gagal memuat pengaturan')))
  }, [])

  if (!cfg) return <div className="ak-section">{error ? <div className="rr-warn"><AlertTriangle size={14} /> {error}</div> : <div className="ak-empty">Memuat…</div>}</div>

  const dirty = saved !== JSON.stringify(cfg)
  const setDiv = (k, patch) => setCfg(c => ({ ...c, divisions: { ...c.divisions, [k]: { ...c.divisions[k], ...patch } } }))
  const setPic = (k, i, patch) => setDiv(k, { pics: cfg.divisions[k].pics.map((p, j) => j === i ? { ...p, ...patch } : p) })
  const movePic = (k, i, dir) => {
    const pics = [...cfg.divisions[k].pics]
    const j = i + dir
    if (j < 0 || j >= pics.length) return
    ;[pics[i], pics[j]] = [pics[j], pics[i]]
    setDiv(k, { pics })
  }

  const save = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const d = await saveAiTeam(cfg)
      setCfg(d); setSaved(JSON.stringify(d)); setNotice('Pengaturan Tanya Tim disimpan.'); setTimeout(() => setNotice(''), 2500)
    } catch (e) { setError(errMsg(e, 'Gagal menyimpan')) }
    finally { setBusy(false) }
  }
  const runCheck = async () => {
    setChecking(true); setError('')
    try { setCheck(await checkTeamNumbers()) } catch (e) { setError(errMsg(e, 'Gagal mengecek nomor')) }
    finally { setChecking(false) }
  }
  const norm = (v) => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('0')) d = `62${d.slice(1)}`; else if (d.startsWith('8')) d = `62${d}`; return d }
  const noPic = cfg.enabled && !['gudang', 'teknis'].some(k => cfg.divisions[k].enabled && cfg.divisions[k].pics.length)

  return (
    <div className="ak-section">
      <div className="ak-head">
        <div>
          <div className="aa-title">Tanya Tim</div>
          <div className="aa-desc">Bila customer menanyakan stok atau hal teknis, AI Sales mengabari customer bahwa sedang dicek, lalu menanyakannya lewat WA ke PIC divisi dengan gaya chat antar rekan kerja. PIC cukup <b>membalas (reply) pesan</b> itu; AI meneruskan jawabannya ke customer. Nomor PIC dianggap internal: tidak masuk Inbox & Analytics.</div>
        </div>
        <div className="ak-head-actions">
          <button className={`aa-switch${cfg.enabled ? ' on' : ''}`} onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))} role="switch" aria-checked={cfg.enabled} title={cfg.enabled ? 'Nonaktifkan' : 'Aktifkan'}><span className="aa-knob" /></button>
          <button className="am-btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>

      {noPic && <div className="rr-warn"><AlertTriangle size={14} /> Isi minimal satu nomor PIC Gudang atau Teknis agar AI bisa bertanya ke tim.</div>}

      <div className="tt-times">
        <label className="rr-field">
          <span>Pengingat & pindah ke PIC cadangan (menit)</span>
          <input type="number" min="5" max="240" value={cfg.remind_min} onChange={e => setCfg(c => ({ ...c, remind_min: e.target.value }))} />
          <small>Belum dijawab -> PIC diingatkan, pertanyaan diteruskan ke PIC cadangan, customer dikabari "masih dicek".</small>
        </label>
        <label className="rr-field">
          <span>Notifikasi admin (menit)</span>
          <input type="number" min="10" max="480" value={cfg.admin_min} onChange={e => setCfg(c => ({ ...c, admin_min: e.target.value }))} />
          <small>Dihitung dalam jam kerja (Sistem → Jam Kerja; bila tidak diatur 08.00–20.00 WIB).</small>
        </label>
      </div>

      {DIVS.map(({ key, label, icon: Icon, desc }) => {
        const d = cfg.divisions[key]
        return (
          <div key={key} className={`tt-div-card${d.enabled ? '' : ' off'}`}>
            <div className="tt-div-head">
              <div className="tt-div-title"><Icon size={16} /><b>{label}</b></div>
              <label className="tt-toggle"><input type="checkbox" checked={d.enabled} onChange={e => setDiv(key, { enabled: e.target.checked })} /> Aktif</label>
            </div>
            <div className="tt-div-desc">{desc}</div>

            <div className="tt-pics">
              <div className="tt-pics-head"><span>PIC (urutan = prioritas)</span></div>
              {d.pics.map((p, i) => (
                <div key={i} className="tt-pic">
                  <span className={`tt-role${i === 0 ? ' main' : ''}`}>{i === 0 ? 'Utama' : `Cadangan ${i}`}</span>
                  <input className="tt-in call" value={p.call} maxLength={40} placeholder="Panggilan, mis. mas andi" onChange={e => setPic(key, i, { call: e.target.value })} />
                  <input className="tt-in phone" value={p.phone} inputMode="tel" placeholder="Nomor WA, mis. 0812…" onChange={e => setPic(key, i, { phone: e.target.value })} />
                  {check && check[norm(p.phone)] !== undefined && (
                    check[norm(p.phone)] ? <CheckCircle2 size={16} className="tt-ok" title="Terdaftar di WhatsApp" /> : <AlertTriangle size={16} className="tt-bad" title="Tidak ditemukan di WhatsApp" />
                  )}
                  <div className="tt-pic-actions">
                    <button onClick={() => movePic(key, i, -1)} disabled={i === 0} aria-label="Naikkan"><ArrowUp size={14} /></button>
                    <button onClick={() => movePic(key, i, 1)} disabled={i === d.pics.length - 1} aria-label="Turunkan"><ArrowDown size={14} /></button>
                    <button onClick={() => setDiv(key, { pics: d.pics.filter((_, j) => j !== i) })} aria-label="Hapus"><X size={14} /></button>
                  </div>
                </div>
              ))}
              {d.pics.length < 5 && <button className="ak-link" onClick={() => setDiv(key, { pics: [...d.pics, { call: '', phone: '' }] })}><Plus size={12} /> Tambah PIC</button>}
            </div>

            <label className="rr-field">
              <span>Topik / contoh pertanyaan yang ditanyakan ke {label}</span>
              <textarea rows={key === 'teknis' ? 6 : 4} value={d.topics} onChange={e => setDiv(key, { topics: e.target.value })} />
              <small>Satu topik per baris. AI memakai daftar ini untuk menentukan kapan harus bertanya ke tim.</small>
            </label>
          </div>
        )
      })}

      <div className="tt-foot">
        <button className="am-btn" onClick={runCheck} disabled={checking}><PhoneCall size={14} />{checking ? 'Mengecek…' : 'Cek nomor di WhatsApp'}</button>
        <span>Simpan dulu sebelum mengecek nomor baru. Minta PIC menyimpan nomor WA dashboard agar pesannya tidak tertahan.</span>
      </div>

      {error && <div className="rr-warn"><AlertTriangle size={14} /> {error}</div>}
      {notice && <div className="mm-notice"><CheckCircle2 size={14} /> {notice}</div>}

      <RequestList onOpenChat={onOpenChat} />

      <style>{`
        .mm-notice { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--success); }
        .tt-times { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .tt-div-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface2); }
        .tt-div-card.off { opacity: 0.65; }
        .tt-div-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .tt-div-title { display: flex; align-items: center; gap: 8px; color: #8b5cf6; }
        .tt-div-title b { font-size: 14px; color: var(--text); }
        .tt-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text2); cursor: pointer; }
        .tt-toggle input { accent-color: var(--primary); }
        .tt-div-desc { font-size: 12.5px; color: var(--text2); line-height: 1.5; }
        .tt-pics { display: flex; flex-direction: column; gap: 6px; }
        .tt-pics-head span { font-size: 12px; font-weight: 600; color: var(--text2); }
        .tt-pic { display: flex; align-items: center; gap: 8px; }
        .tt-role { width: 86px; flex-shrink: 0; font-size: 11.5px; font-weight: 700; color: var(--muted); }
        .tt-role.main { color: var(--primary); }
        .tt-in { height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; outline: none; min-width: 0; }
        .tt-in:focus { border-color: var(--primary); }
        .tt-in.call { flex: 1; }
        .tt-in.phone { flex: 1.2; font-variant-numeric: tabular-nums; }
        .tt-ok { color: var(--success); flex-shrink: 0; }
        .tt-bad { color: var(--warning, #d08b28); flex-shrink: 0; }
        .tt-pic-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .tt-pic-actions button { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: var(--muted); }
        .tt-pic-actions button:hover:not(:disabled) { background: var(--surface3); color: var(--text); }
        .tt-pic-actions button:disabled { opacity: 0.35; }
        .tt-pics .ak-link { align-self: flex-start; font-size: 12px; }
        .tt-div-card .rr-field textarea { background: var(--surface); }
        .tt-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); }
        .tt-hist { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border); padding-top: 14px; }
        .tt-hist-head { display: flex; align-items: center; justify-content: space-between; }
        .tt-hist-head b { font-size: 13.5px; color: var(--text); }
        .tt-req { display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
        .tt-req-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .tt-req-top b { flex: 1; min-width: 0; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tt-div { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(139,92,246,0.12); color: #8b5cf6; }
        .tt-div.teknis { background: rgba(49,130,206,0.12); color: #3182ce; }
        .tt-div.procurement { background: rgba(214,158,46,0.14); color: #b7791f; }
        .tt-st { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--surface3); color: var(--text2); }
        .tt-st.wait { background: rgba(214,158,46,0.14); color: #b7791f; }
        .tt-st.ask { background: rgba(49,130,206,0.12); color: #3182ce; }
        .tt-st.ok { background: rgba(56,161,105,0.14); color: var(--success); }
        .tt-st.bad { background: rgba(229,62,62,0.1); color: var(--danger); }
        .tt-req-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--muted); }
        .tt-req-meta .ak-link { font-size: 12px; }
        .tt-ans { font-size: 12.5px; color: var(--text2); line-height: 1.45; padding: 7px 10px; border-radius: 8px; background: var(--surface2); white-space: pre-wrap; }
        .tt-close { align-self: flex-start; font-size: 12px; }
        @media (max-width: 768px) {
          .mm-notice { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--success); }
        .tt-times { grid-template-columns: 1fr; }
          .tt-pic { flex-wrap: wrap; }
          .tt-role { width: 100%; }
          .tt-in.call, .tt-in.phone { flex: 1 1 140px; }
        }
      `}</style>
    </div>
  )
}

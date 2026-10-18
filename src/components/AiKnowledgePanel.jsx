import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Upload, Wand2, Search, BookOpen, GraduationCap, Pin } from 'lucide-react'
import {
  getAiSkills, createAiSkill, updateAiSkill, deleteAiSkill, suggestAiSkillKeywords, testAiSkills,
  getAiLessons, updateAiLesson, deleteAiLesson,
} from '../hooks/useApi'

// Dipakai di Manajemen Agent → AI Sales (memakai kelas am-* dari halaman tsb).

const errMsg = (e, fallback) => e?.response?.data?.error || fallback

// File .md -> { title, when_to_use, keywords, always, content }.
// Mendukung front matter ala SKILL.md (name/title, description/when, keywords, always).
export function parseSkillFile(text, filename) {
  let body = String(text || '').replace(/\r\n/g, '\n')
  const meta = {}
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/)
      if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    body = body.slice(fm[0].length)
  }
  let title = meta.title || meta.name || ''
  const h1 = body.match(/^#\s+(.+)\n?/m)
  if (!title && h1) { title = h1[1].trim(); body = body.replace(h1[0], '') }
  if (!title) title = String(filename || 'Skill').replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ')
  return {
    title: title.slice(0, 120),
    when_to_use: (meta.description || meta.when || meta.when_to_use || '').slice(0, 500),
    keywords: (meta.keywords || '').replace(/^\[|\]$/g, ''),
    always: /^(true|ya|yes|1)$/i.test(meta.always || ''),
    content: body.trim(),
  }
}

function SkillModal({ initial, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ title: '', when_to_use: '', keywords: '', content: '', always: false, active: true, ...(initial || {}) }))
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const suggest = async () => {
    setSuggesting(true); setError('')
    try { const r = await suggestAiSkillKeywords(f); if (r.keywords) set('keywords', r.keywords) }
    catch (e) { setError(errMsg(e, 'Gagal menyarankan kata kunci')) }
    finally { setSuggesting(false) }
  }
  const save = async (e) => {
    e.preventDefault()
    if (!f.title.trim() || !f.content.trim()) { setError('Judul dan isi wajib diisi.'); return }
    setBusy(true); setError('')
    try {
      const payload = { title: f.title, when_to_use: f.when_to_use, keywords: f.keywords, content: f.content, always: f.always, active: f.active }
      onSaved(initial?.id ? await updateAiSkill(initial.id, payload) : await createAiSkill(payload))
    } catch (e2) { setError(errMsg(e2, 'Gagal menyimpan skill')) }
    finally { setBusy(false) }
  }

  return (
    <div className="am-overlay" onClick={onClose}>
      <form className="am-modal ak-modal" onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className="am-modal-header">
          <h3>{initial?.id ? 'Edit Skill' : 'Tambah Skill'}</h3>
          <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="ak-form">
          <div className="am-field">
            <label>Judul</label>
            <input value={f.title} onChange={e => set('title', e.target.value)} maxLength={120} placeholder="mis. Menangani keberatan harga" autoFocus />
          </div>
          <div className="am-field">
            <label>Kapan dipakai</label>
            <input value={f.when_to_use} onChange={e => set('when_to_use', e.target.value)} maxLength={500} placeholder="mis. customer bilang mahal, minta diskon, atau membandingkan harga" />
          </div>
          <div className="am-field">
            <label className="ak-label-row">
              <span>Kata kunci <small>(pisahkan dengan koma)</small></span>
              <button type="button" className="ak-link" onClick={suggest} disabled={suggesting || !f.content.trim()}>
                <Wand2 size={13} />{suggesting ? 'Menyarankan…' : 'Sarankan dengan AI'}
              </button>
            </label>
            <input value={f.keywords} onChange={e => set('keywords', e.target.value)} maxLength={600} placeholder="mahal, diskon, nego, budget — kosongkan agar diisi AI saat disimpan" />
          </div>
          <div className="am-field">
            <label>Isi (Markdown)</label>
            <textarea className="ak-md" rows={13} value={f.content} onChange={e => set('content', e.target.value)}
              placeholder={'## Langkah\n1. Akui dulu perasaan customer…\n2. Tunjukkan hitungan hemat tagihan & balik modal…\n\n## Contoh kalimat\n- "Wajar kak, tapi…"\n\n## Jangan\n- Menjanjikan diskon'} />
          </div>
          <div className="ak-checks">
            <label><input type="checkbox" checked={f.always} onChange={e => set('always', e.target.checked)} /> Selalu dipakai <small>(untuk info umum, mis. profil perusahaan)</small></label>
            <label><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> Aktif</label>
          </div>
          {error && <div className="am-form-err">{error}</div>}
        </div>
        <div className="ak-modal-foot">
          <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="am-btn primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}

function SkillsSection() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState(null)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try { setSkills(await getAiSkills()); setError('') } catch (e) { setError(errMsg(e, 'Gagal memuat skill')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onUpload = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setUploading(true); setError('')
    const created = []
    for (const file of files) {
      try {
        const sk = parseSkillFile(await file.text(), file.name)
        if (!sk.content) continue
        created.push(await createAiSkill(sk))
      } catch (err) { setError(`${file.name}: ${errMsg(err, 'gagal diunggah')}`) }
    }
    setSkills(prev => [...created, ...prev])
    setUploading(false)
  }

  const toggle = async (s) => {
    try { const u = await updateAiSkill(s.id, { active: !s.active }); setSkills(prev => prev.map(x => x.id === u.id ? u : x)) }
    catch (e) { setError(errMsg(e, 'Gagal mengubah skill')) }
  }
  const remove = async (s) => {
    if (!window.confirm(`Hapus skill "${s.title}"?`)) return
    try { await deleteAiSkill(s.id); setSkills(prev => prev.filter(x => x.id !== s.id)) }
    catch (e) { setError(errMsg(e, 'Gagal menghapus skill')) }
  }
  const runTest = async () => {
    if (!testText.trim()) return
    try { setTestResult(await testAiSkills(testText)) } catch (e) { setError(errMsg(e, 'Gagal menguji')) }
  }

  return (
    <div className="ak-section">
      <div className="ak-head">
        <div>
          <div className="aa-title">Skill / Playbook</div>
          <div className="aa-desc">Dokumen pedoman (Markdown) yang dibaca AI. Untuk tiap chat, AI memakai maks. 3 skill yang paling cocok dengan pesan customer, ditambah skill bertanda "Selalu dipakai".</div>
        </div>
        <div className="ak-head-actions">
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt" multiple hidden onChange={onUpload} />
          <button className="am-btn secondary" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload size={15} />{uploading ? 'Mengunggah…' : 'Unggah .md'}</button>
          <button className="am-btn primary" onClick={() => setModal({})}><Plus size={15} />Tambah Skill</button>
        </div>
      </div>

      <div className="ak-test">
        <Search size={15} />
        <input value={testText} onChange={e => setTestText(e.target.value)} onKeyDown={e => e.key === 'Enter' && runTest()}
          placeholder="Uji: ketik contoh pesan customer, mis. &quot;kok mahal ya kak, bisa kurang?&quot;" />
        <button className="am-btn secondary" onClick={runTest} disabled={!testText.trim()}>Uji</button>
      </div>
      {testResult && (
        <div className="ak-test-result">
          {testResult.length === 0 ? 'Tidak ada skill yang terpilih untuk pesan ini.' : (
            <>Skill yang dipakai: {testResult.map(r => (
              <span key={r.id} className="ak-chip">{r.always ? <Pin size={11} /> : null}{r.title}{r.hits?.length ? ` · ${r.hits.join(', ')}` : ''}</span>
            ))}</>
          )}
        </div>
      )}

      {error && <div className="am-form-err">{error}</div>}
      {loading ? <div className="ak-empty">Memuat…</div> : skills.length === 0 ? (
        <div className="ak-empty"><BookOpen size={28} strokeWidth={1.5} />Belum ada skill. Tambahkan pedoman seperti menangani keberatan harga, FAQ teknis, profil perusahaan, atau prosedur survei — atau unggah file .md.</div>
      ) : (
        <div className="ak-list">
          {skills.map(s => (
            <div key={s.id} className={`ak-card${s.active ? '' : ' off'}`}>
              <div className="ak-card-top">
                <div className="ak-card-title">
                  <b>{s.title}</b>
                  {s.always && <span className="ak-badge pin"><Pin size={10} />Selalu dipakai</span>}
                  {!s.active && <span className="ak-badge">Nonaktif</span>}
                </div>
                <div className="am-actions">
                  <button className={`aa-switch sm${s.active ? ' on' : ''}`} onClick={() => toggle(s)} role="switch" aria-checked={!!s.active} title={s.active ? 'Nonaktifkan' : 'Aktifkan'}><span className="aa-knob" /></button>
                  <button className="am-icon-btn edit" onClick={() => setModal(s)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="am-icon-btn del" onClick={() => remove(s)} aria-label="Hapus"><Trash2 size={15} /></button>
                </div>
              </div>
              {s.when_to_use && <div className="ak-when">Dipakai saat: {s.when_to_use}</div>}
              <div className="ak-preview">{s.content}</div>
              {s.keywords && (
                <div className="ak-kws">{s.keywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 10).map(k => <span key={k} className="ak-kw">{k}</span>)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SkillModal initial={modal.id ? modal : null} onClose={() => setModal(null)}
          onSaved={(sk) => { setSkills(prev => prev.some(x => x.id === sk.id) ? prev.map(x => x.id === sk.id ? sk : x) : [sk, ...prev]); setModal(null) }} />
      )}
    </div>
  )
}

function LessonModal({ lesson, onClose, onSaved }) {
  const [better, setBetter] = useState(lesson.better_reply || '')
  const [note, setNote] = useState(lesson.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { onSaved(await updateAiLesson(lesson.id, { better_reply: better, note })) }
    catch (e2) { setError(errMsg(e2, 'Gagal menyimpan')) }
    finally { setBusy(false) }
  }
  return (
    <div className="am-overlay" onClick={onClose}>
      <form className="am-modal ak-modal" onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className="am-modal-header">
          <h3>Edit Koreksi</h3>
          <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="ak-form">
          <div className="am-field"><label>Balasan yang benar</label><textarea className="ak-md plain" rows={4} value={better} onChange={e => setBetter(e.target.value)} /></div>
          <div className="am-field"><label>Alasan / aturan</label><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></div>
          {error && <div className="am-form-err">{error}</div>}
        </div>
        <div className="ak-modal-foot">
          <button type="button" className="am-btn secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="am-btn primary" disabled={busy || !better.trim()}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}

function LessonsSection() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  useEffect(() => {
    getAiLessons().then(d => { setLessons(d); setError('') }).catch(e => setError(errMsg(e, 'Gagal memuat koreksi'))).finally(() => setLoading(false))
  }, [])
  const toggle = async (l) => {
    try { const u = await updateAiLesson(l.id, { active: !l.active }); setLessons(prev => prev.map(x => x.id === u.id ? u : x)) }
    catch (e) { setError(errMsg(e, 'Gagal mengubah')) }
  }
  const remove = async (l) => {
    if (!window.confirm('Hapus koreksi ini?')) return
    try { await deleteAiLesson(l.id); setLessons(prev => prev.filter(x => x.id !== l.id)) }
    catch (e) { setError(errMsg(e, 'Gagal menghapus')) }
  }
  return (
    <div className="ak-section">
      <div className="ak-head">
        <div>
          <div className="aa-title">Koreksi dari Admin</div>
          <div className="aa-desc">Setiap koreksi menjadi pelajaran "jangan seperti ini → sebaiknya begini" yang langsung dipakai AI di chat berikutnya. Tambahkan koreksi dari layar chat lewat tombol <b>Koreksi</b> pada balasan AI.</div>
        </div>
      </div>
      {error && <div className="am-form-err">{error}</div>}
      {loading ? <div className="ak-empty">Memuat…</div> : lessons.length === 0 ? (
        <div className="ak-empty"><GraduationCap size={28} strokeWidth={1.5} />Belum ada koreksi. Buka chat milik AI, arahkan kursor ke balasan AI lalu pilih <b>Koreksi</b>.</div>
      ) : (
        <div className="ak-list">
          {lessons.map(l => (
            <div key={l.id} className={`ak-card${l.active ? '' : ' off'}`}>
              <div className="ak-card-top">
                <div className="ak-card-title">
                  <span className="ak-date">{new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {!l.active && <span className="ak-badge">Nonaktif</span>}
                </div>
                <div className="am-actions">
                  <button className={`aa-switch sm${l.active ? ' on' : ''}`} onClick={() => toggle(l)} role="switch" aria-checked={!!l.active}><span className="aa-knob" /></button>
                  <button className="am-icon-btn edit" onClick={() => setEditing(l)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="am-icon-btn del" onClick={() => remove(l)} aria-label="Hapus"><Trash2 size={15} /></button>
                </div>
              </div>
              {l.customer_message && <div className="ak-l-row"><span>Customer</span><p>{l.customer_message}</p></div>}
              <div className="ak-l-row bad"><span>AI</span><p>{l.ai_reply}</p></div>
              <div className="ak-l-row good"><span>Sebaiknya</span><p>{l.better_reply}</p></div>
              {l.note && <div className="ak-when">Aturan: {l.note}</div>}
            </div>
          ))}
        </div>
      )}
      {editing && <LessonModal lesson={editing} onClose={() => setEditing(null)} onSaved={(u) => { setLessons(prev => prev.map(x => x.id === u.id ? u : x)); setEditing(null) }} />}
    </div>
  )
}

export default function AiKnowledgePanel({ section }) {
  return (
    <>
      {section === 'skills' ? <SkillsSection /> : <LessonsSection />}
      <style>{`
        .ak-section { display: flex; flex-direction: column; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 3px var(--shadow); }
        .ak-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .ak-head-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .ak-test { display: flex; align-items: center; gap: 8px; padding: 0 0 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface2); color: var(--muted); }
        .ak-test input { flex: 1; min-width: 0; height: 38px; background: none; border: none; outline: none; color: var(--text); font-size: 13px; font-family: inherit; }
        .ak-test .am-btn { border-radius: 0 9px 9px 0; border-width: 0 0 0 1px; }
        .ak-test-result { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text2); }
        .ak-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; background: rgba(124,58,237,0.12); color: #8b5cf6; font-weight: 600; font-size: 12px; }
        .ak-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 16px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.5; }
        .ak-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
        .ak-card { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface2); min-width: 0; }
        .ak-card.off { opacity: 0.6; }
        .ak-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ak-card-title { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; font-size: 13.5px; color: var(--text); }
        .ak-card .am-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        .ak-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--surface3); color: var(--text2); }
        .ak-badge.pin { background: rgba(124,58,237,0.13); color: #8b5cf6; }
        .ak-when { font-size: 12px; color: var(--text2); }
        .ak-preview { font-size: 12px; color: var(--muted); white-space: pre-wrap; max-height: 64px; overflow: hidden; line-height: 1.45; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .ak-kws { display: flex; flex-wrap: wrap; gap: 4px; }
        .ak-kw { font-size: 11px; padding: 1px 7px; border-radius: 6px; background: var(--surface3); color: var(--text2); }
        .ak-date { font-size: 12px; color: var(--muted); }
        .ak-l-row { display: grid; grid-template-columns: 70px 1fr; gap: 8px; font-size: 12.5px; }
        .ak-l-row span { color: var(--muted); font-weight: 600; font-size: 11.5px; padding-top: 2px; }
        .ak-l-row p { color: var(--text2); white-space: pre-wrap; line-height: 1.45; }
        .ak-l-row.bad p { color: var(--danger); text-decoration: line-through; text-decoration-color: rgba(229,62,62,0.5); }
        .ak-l-row.good p { color: var(--success); font-weight: 500; }
        .ak-modal { max-width: 640px; }
        .ak-form { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; }
        .ak-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ak-label-row small, .ak-checks small { font-weight: 400; color: var(--muted); }
        .ak-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--primary); }
        .ak-link:disabled { opacity: 0.5; }
        .ak-md { width: 100%; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); font-size: 13px; line-height: 1.5; resize: vertical; outline: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .ak-md.plain { font-family: inherit; }
        .ak-md:focus { border-color: var(--primary); }
        .ak-checks { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text); }
        .ak-checks label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .ak-checks input { width: 16px; height: 16px; accent-color: var(--primary); }
        .ak-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px 16px; border-top: 1px solid var(--border); }
        @media (max-width: 768px) {
          .ak-head { flex-direction: column; }
          .ak-head-actions { width: 100%; }
          .ak-head-actions .am-btn { flex: 1; }
          .ak-list { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}

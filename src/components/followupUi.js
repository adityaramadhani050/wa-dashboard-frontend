// Utilitas tampilan follow-up (label tahap, warna, jatuh tempo).
export const STEP_ORDER = ['confirm', 'feedback', 'objection', 'values', 'reactivation']
export const STEP_INFO = {
  confirm: { label: 'CONFIRM', day: 'H+1', color: '#2563eb' },
  feedback: { label: 'FEEDBACK', day: 'H+3', color: '#7c3aed' },
  objection: { label: 'OBJECTION', day: 'H+7', color: '#d97706' },
  values: { label: 'VALUES', day: 'H+14', color: '#059669' },
  reactivation: { label: 'REACTIVATION', day: 'H+30', color: '#db2777' },
  nurture: { label: 'NURTURE', day: '+30', color: '#0891b2' },
  manual: { label: 'PENGINGAT', day: '', color: '#64748b' },
}

export const OBJECTION_LABEL = {
  harga: 'Harga', spek: 'Spek', kebutuhan: 'Kebutuhan', timing: 'Timing', approval: 'Approval', kompetitor: 'Kompetitor',
}

const DAY = 86400000
const TZ = 7 * 3600 * 1000
const wibDayStart = (ts) => Math.floor((new Date(ts).getTime() + TZ) / DAY) * DAY - TZ

// "Hari ini" · "Terlambat 2 hari" · "Besok" · "3 hari lagi" · "Menunggu chat selesai"
export function dueLabel(task) {
  if (!task) return ''
  if (task.status === 'paused' || !task.due_at) return 'Menunggu chat selesai'
  const diff = Math.round((wibDayStart(task.due_at) - wibDayStart(Date.now())) / DAY)
  if (diff === 0) return 'Hari ini'
  if (diff < 0) return `Terlambat ${-diff} hari`
  if (diff === 1) return 'Besok'
  return `${diff} hari lagi`
}

export function dueTone(task) {
  if (!task || task.status === 'paused' || !task.due_at) return 'wait'
  const diff = Math.round((wibDayStart(task.due_at) - wibDayStart(Date.now())) / DAY)
  return diff < 0 ? 'late' : diff === 0 ? 'today' : 'later'
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Isi {{nama}} pada template (nama berupa nomor -> dihilangkan)
export function fillName(tpl, name) {
  const n = name && !/^\+?\d[\d\s-]*$/.test(name) ? String(name).trim() : ''
  return String(tpl || '').replace(/\s*\{\{\s*nama\s*\}\}/gi, n ? ` ${n}` : '').replace(/[ \t]{2,}/g, ' ').trim()
}

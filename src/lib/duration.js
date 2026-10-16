// Format durasi (menit) yang dipakai bersama: badge overdue di Chat & waktu respons di Analytics.

// Ringkas: <1m · 45m · 2j 15m · 3h 4j · 13h   (m = menit, j = jam, h = hari)
export function formatDurShort(mins) {
  if (mins == null || Number.isNaN(mins)) return '—'
  mins = Math.max(0, Math.round(mins))
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d === 0) return m ? `${h}j ${m}m` : `${h}j`
  if (d >= 7 || !h) return `${d}h`
  return `${d}h ${h}j`
}

// Lengkap (untuk tooltip): "2 jam 15 menit", "13 hari 2 jam"
export function formatDurLong(mins) {
  if (mins == null || Number.isNaN(mins)) return ''
  mins = Math.max(0, Math.round(mins))
  if (mins < 1) return 'kurang dari 1 menit'
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const parts = []
  if (d) parts.push(`${d} hari`)
  if (h) parts.push(`${h} jam`)
  if (m && !d) parts.push(`${m} menit`)
  return parts.join(' ') || '0 menit'
}

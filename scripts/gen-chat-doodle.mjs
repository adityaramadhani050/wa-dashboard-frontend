// Jalankan: node scripts/gen-chat-doodle.mjs  -> public/chat-doodle-{light,dark}.svg
// Generator pola latar percakapan (ubin SVG mulus) dari ikon Lucide (ISC) + ikon kustom PLTS.
import fs from 'fs'
const ROOT = new URL('..', import.meta.url).pathname
const DIR = ROOT + 'node_modules/lucide-react/dist/esm/icons/'
function lucide(name) {
  const src = fs.readFileSync(`${DIR}${name}.js`, 'utf8')
  const arr = src.slice(src.indexOf('['), src.lastIndexOf(']') + 1)
  return eval(arr) // [[tag, attrs], ...]
}
const custom = {
  'solar-panel': [
    ['path', { d: 'M4 4h16l-2 10H2z' }], ['path', { d: 'M3 9h16' }], ['path', { d: 'M9.3 4l-1.6 10' }], ['path', { d: 'M14.7 4l-1.6 10' }],
    ['path', { d: 'M10 14v5' }], ['path', { d: 'M6.5 20h7' }],
  ],
  'house-solar': [
    ['path', { d: 'M3 11l9-7 9 7' }], ['path', { d: 'M5 9.5V20h14V9.5' }], ['path', { d: 'M10 20v-5h4v5' }],
    ['path', { d: 'M13.5 6.6l4.2 3.2' }], ['path', { d: 'M15.3 5.9l3 2.3' }],
  ],
  'inverter': [
    ['rect', { x: '5', y: '3', width: '14', height: '18', rx: '2' }], ['rect', { x: '8', y: '6', width: '8', height: '4', rx: '1' }],
    ['path', { d: 'M12 13l-1.5 2.5h3L12 18' }],
  ],
  'panel-sun': [
    ['circle', { cx: '17', cy: '6', r: '2.5' }], ['path', { d: 'M17 1.5v1M21.5 6h-1M20.2 2.8l-.7.7' }],
    ['path', { d: 'M3 12h12l-1.5 7H1.5z' }], ['path', { d: 'M2.3 15.5h12' }], ['path', { d: 'M7.3 12l-.8 7' }],
  ],
}
const ICONS = ['sun', 'solar-panel', 'zap', 'battery-charging', 'house-solar', 'leaf', 'plug-zap', 'cloud-sun', 'lightbulb', 'wind',
  'solar-panel', 'utility-pole', 'sprout', 'inverter', 'sun-medium', 'car', 'gauge', 'recycle', 'house', 'tree-pine', 'battery-full',
  'panel-sun', 'plug', 'message-circle', 'sunrise', 'calculator', 'shield-check', 'handshake', 'power', 'thermometer-sun',
  'wrench', 'cable', 'droplet', 'factory', 'star', 'wallet', 'phone', 'map-pin', 'trees', 'calendar', 'receipt', 'flower-2',
  'solar-panel', 'zap', 'sun-dim', 'building-2', 'heart', 'cloud', 'leaf']
let seed = 20261020
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const esc = (v) => String(v).replace(/"/g, '&quot;')
function iconEls(name) {
  const node = custom[name] || lucide(name)
  return node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('')
}
const TILE = 420, N = 7, CELL = TILE / N // 60px per sel -> ikon tidak pernah melewati tepi ubin
const order = [...ICONS]
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
let body = ''
let k = 0
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const name = order[k++ % order.length]
  const size = 22 + rnd() * 6          // 22-28px
  const s = size / 24
  const cx = c * CELL + CELL / 2 + (rnd() - 0.5) * 14
  const cy = r * CELL + CELL / 2 + (rnd() - 0.5) * 14
  const rot = (rnd() - 0.5) * 50
  body += `<g transform="translate(${(cx).toFixed(1)} ${(cy).toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(3)}) translate(-12 -12)">${iconEls(name)}</g>`
  // Pengisi kecil (titik / plus) di sudut sel agar padat seperti WhatsApp
  const fx = c * CELL + (rnd() < 0.5 ? 6 : CELL - 6), fy = r * CELL + (rnd() < 0.5 ? 6 : CELL - 6)
  const kind = rnd()
  if (kind < 0.45) body += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="1.4" fill="COLOR" stroke="none"/>`
  else if (kind < 0.75) body += `<path d="M${(fx - 2.5).toFixed(1)} ${fy.toFixed(1)}h5M${fx.toFixed(1)} ${(fy - 2.5).toFixed(1)}v5"/>`
}
const make = (color, op) => `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><g fill="none" stroke="${color}" stroke-opacity="${op}" fill-opacity="${op}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body.replace(/COLOR/g, color)}</g></svg>\n`
const out = ROOT + 'public/'
fs.writeFileSync(out + 'chat-doodle-light.svg', make('#5b4a36', 0.1)) // coklat hangat di atas latar krem
fs.writeFileSync(out + 'chat-doodle-dark.svg', make('#ffffff', 0.055))
console.log('ok', fs.statSync(out + 'chat-doodle-dark.svg').size, 'bytes')

import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'

// Render halaman pertama PDF sebagai thumbnail (pdf.js, di sisi browser).
// Optimalisasi:
//  - pdf.js + worker dimuat sekali (lazy) dan dibagi seluruh aplikasi
//  - hasil render di-cache sebagai data URL per (url,width) -> tidak render ulang
//  - render hanya saat elemen mendekati viewport (IntersectionObserver)
//  - render dibatasi satu per satu (antrian) agar tidak membebani CPU
let pdfjsPromise = null
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })()
  }
  return pdfjsPromise
}

const thumbCache = new Map() // key: `${url}@${width}` -> dataURL
let queue = Promise.resolve() // antrian render serial

function renderPdfThumb(url, width) {
  const key = `${url}@${width}`
  if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key))
  // Rantai ke antrian agar render tidak jalan paralel (hemat CPU/memori)
  const run = queue.then(async () => {
    if (thumbCache.has(key)) return thumbCache.get(key)
    const pdfjs = await getPdfjs()
    const pdf = await pdfjs.getDocument({ url }).promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = width / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    thumbCache.set(key, dataUrl)
    pdf.destroy?.()
    return dataUrl
  })
  queue = run.catch(() => {}) // jaga antrian tetap hidup walau ada error
  return run
}

export function isPdf(mimetype, url) {
  return mimetype === 'application/pdf' || /\.pdf($|\?)/i.test(url || '')
}

export default function PdfThumb({ url, width = 220 }) {
  const key = `${url}@${width}`
  const ref = useRef(null)
  const [src, setSrc] = useState(() => thumbCache.get(key) || null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (thumbCache.has(key)) { setSrc(thumbCache.get(key)); return }
    setSrc(null); setError(false)
    let cancelled = false
    const el = ref.current
    if (!el) return
    const start = () => {
      renderPdfThumb(url, width)
        .then(d => { if (!cancelled) setSrc(d) })
        .catch(() => { if (!cancelled) setError(true) })
    }
    // Render hanya saat mendekati viewport
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); start() }
    }, { rootMargin: '150px' })
    io.observe(el)
    return () => { cancelled = true; io.disconnect() }
  }, [key, url, width])

  if (src) return <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  return (
    <div ref={ref} className="tp-media-doc-icon" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FileText size={26} opacity={error ? 0.5 : 0.8} />
    </div>
  )
}

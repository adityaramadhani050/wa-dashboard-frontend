import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'

// Render halaman pertama PDF sebagai thumbnail (pakai pdf.js, di sisi browser).
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

export function isPdf(mimetype, url) {
  return mimetype === 'application/pdf' || /\.pdf($|\?)/i.test(url || '')
}

export default function PdfThumb({ url, width = 240 }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | done | error

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const pdfjs = await getPdfjs()
        const pdf = await pdfjs.getDocument({ url }).promise
        const page = await pdf.getPage(1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        if (!cancelled) setStatus('done')
      } catch { if (!cancelled) setStatus('error') }
    })()
    return () => { cancelled = true }
  }, [url, width])

  return (
    <>
      <canvas ref={canvasRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'done' ? 'block' : 'none' }} />
      {status !== 'done' && <div className="tp-media-doc-icon"><FileText size={28} /></div>}
    </>
  )
}

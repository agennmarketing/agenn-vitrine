'use client'

import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

// QR Code da vitrine desenhado na própria página, com o botão para baixar em PNG.
export function QrCodeCard({ url, subdomain }: { url: string; subdomain: string }) {
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)

  // A biblioteca só é baixada quando a seção Compartilhar abre.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setFailed(false)
      try {
        const { toCanvas } = await import('qrcode')
        if (cancelled || !canvas.current) return
        await toCanvas(canvas.current, url, { width: 320, margin: 2, color: { dark: '#1d1147' } })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  function download() {
    if (!canvas.current) return
    const link = document.createElement('a')
    link.href = canvas.current.toDataURL('image/png')
    link.download = `qrcode-${subdomain}.png`
    link.click()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-card border border-line bg-white p-2">
        {failed ? (
          <p className="flex size-56 items-center justify-center p-4 text-center text-sm font-bold text-danger">
            Não foi possível gerar o QR Code. Recarregue a página.
          </p>
        ) : (
          <canvas ref={canvas} aria-label="QR Code" role="img" className="size-56 max-w-full" />
        )}
      </div>
      <Button onClick={download} disabled={failed} variant="secondary" className="w-full max-w-60">
        <Download aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.75} />
        Baixar PNG
      </Button>
    </div>
  )
}

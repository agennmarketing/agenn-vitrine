'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, buttonClasses } from '@/components/ui/button'

export function QrCodeButton({ url, name, subdomain }: { url: string; name: string; subdomain: string }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // A biblioteca só é baixada quando alguém abre o QR Code.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setFailed(false)
      try {
        const { toCanvas } = await import('qrcode')
        if (cancelled || !canvas.current) return
        await toCanvas(canvas.current, url, { width: 320, margin: 2 })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, url])

  // Foco inicial e Escape para fechar, seguindo o padrão de cart-sheet.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function download() {
    if (!canvas.current) return
    const link = document.createElement('a')
    link.href = canvas.current.toDataURL('image/png')
    link.download = `qrcode-${subdomain}.png`
    link.click()
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        QR Code
      </Button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={`QR Code de ${name}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-control bg-surface p-6 text-center">
        <h2 className="text-lg font-medium">{name}</h2>
        {failed ? (
          <p className="text-sm text-danger">Não foi possível gerar o QR Code. Tente de novo.</p>
        ) : (
          <canvas ref={canvas} aria-label="QR Code" role="img" className="size-[320px] max-w-full" />
        )}
        <p className="break-all text-sm text-ink-muted">{url.replace(/^https?:\/\//, '')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={download} disabled={failed}>
            Baixar PNG
          </Button>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} className={buttonClasses('secondary')}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

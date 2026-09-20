'use client'

import { Download, QrCode, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, type ButtonSize } from '@/components/ui/button'

export function QrCodeButton({ url, name, subdomain, className = '', size }: { url: string; name: string; subdomain: string; className?: string; size?: ButtonSize }) {
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
        await toCanvas(canvas.current, url, { width: 320, margin: 2, color: { dark: '#1d1147' } })
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
      <Button variant="secondary" size={size} className={className} onClick={() => setOpen(true)}>
        <QrCode aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
        QR Code
      </Button>
    )
  }

  // Portal no <body>: o cartão entra com animação (transform), e um fixed lá dentro ficaria preso ao cartão.
  return createPortal(
    <div
      role="dialog"
      aria-label={`QR Code de ${name}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-deep/60 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div className="relative flex w-full max-w-sm animate-sheet-up flex-col items-center gap-4 rounded-t-sheet bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center sm:rounded-sheet">
        <button
          ref={closeRef}
          type="button"
          aria-label="Fechar"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
        >
          <X aria-hidden="true" className="size-5" strokeWidth={3} />
        </button>
        <h2 className="px-10 text-xl font-black tracking-[-0.02em]">{name}</h2>
        <p className="-mt-2 text-sm font-semibold text-ink-muted">Imprima e cole no balcão, na vitrine ou na embalagem.</p>
        <div className="rounded-card border-2 border-line p-2">
          {failed ? (
            <p className="flex size-64 items-center justify-center p-4 text-sm font-bold text-danger">
              Não foi possível gerar o QR Code. Tente de novo.
            </p>
          ) : (
            <canvas ref={canvas} aria-label="QR Code" role="img" className="size-64 max-w-full" />
          )}
        </div>
        <p className="break-all text-sm font-bold text-ink-muted">{url.replace(/^https?:\/\//, '')}</p>
        <Button onClick={download} disabled={failed} size="lg" className="w-full">
          <Download aria-hidden="true" className="size-5" strokeWidth={2.75} />
          Baixar PNG
        </Button>
      </div>
    </div>,
    document.body,
  )
}

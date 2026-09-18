'use client'

import { Check, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import type { PixelCrop } from '@/lib/media/render-crop'

/*
 * Recorte da imagem: no celular sobe como folha de baixo; no computador é uma janela central.
 * Escape cancela; o foco começa no botão de fechar e volta para onde estava ao fechar.
 * Sem fechar ao tocar fora: arrastar a foto e soltar fora da área não pode descartar o recorte.
 */
export function ImageCropper(props: {
  imageUrl: string
  aspect: number
  onCancel: () => void
  onConfirm: (crop: PixelCrop) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const cancelRef = useRef(props.onCancel)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current = props.onCancel
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelRef.current()
    }
    // Trava a rolagem da página enquanto o recorte está aberto.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recortar imagem"
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-deep/70 sm:items-center sm:p-4"
    >
      <div className="flex max-h-dvh w-full max-w-lg animate-sheet-up flex-col overflow-hidden rounded-t-sheet bg-surface sm:rounded-sheet">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Ajuste o recorte</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Fechar"
            onClick={props.onCancel}
            className="-mr-2 flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={3} />
          </button>
        </div>
        <div className="relative h-[min(58dvh,26rem)] bg-deep">
          <Cropper
            image={props.imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={props.aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <p className="-mb-1 text-sm font-semibold text-ink-muted">Arraste a foto para enquadrar. Use o zoom para aproximar.</p>
          <label className="flex items-center gap-3 text-sm font-extrabold text-ink">
            <span>Zoom</span>
            <ZoomOut aria-hidden="true" className="size-5 shrink-0 text-ink-muted" strokeWidth={2.5} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-8 min-w-0 flex-1 cursor-pointer accent-go-strong"
            />
            <ZoomIn aria-hidden="true" className="size-5 shrink-0 text-ink-muted" strokeWidth={2.5} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={props.onCancel}>
              Cancelar
            </Button>
            <Button size="lg" disabled={!area} onClick={() => area && props.onConfirm(area)}>
              <Check aria-hidden="true" className="size-5" strokeWidth={3} />
              Usar imagem
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

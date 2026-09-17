'use client'

import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import type { PixelCrop } from '@/lib/media/render-crop'

export function ImageCropper(props: {
  imageUrl: string
  aspect: number
  onCancel: () => void
  onConfirm: (crop: PixelCrop) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)

  return (
    <div role="dialog" aria-modal="true" aria-label="Recortar imagem" className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4">
      <div className="relative flex-1">
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
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 pt-4">
        <label className="flex items-center gap-3 text-white">
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button disabled={!area} onClick={() => area && props.onConfirm(area)}>
            Usar imagem
          </Button>
        </div>
      </div>
    </div>
  )
}

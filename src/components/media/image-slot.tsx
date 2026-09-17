'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IMAGE_SPECS, type ImageRole } from '@/lib/media/image-specs'
import { renderCrop, type PixelCrop } from '@/lib/media/render-crop'
import { ImageCropper } from './image-cropper'

type SlotMedia = { id: string; url: string }

export function ImageSlot(props: {
  label: string
  role: ImageRole
  vitrineId: string
  itemId?: string | null
  position?: 1 | 2
  initial: SlotMedia | null
  removable?: boolean
  disabled?: boolean
  onChange?: (media: SlotMedia | null) => void
}) {
  const [media, setMedia] = useState<SlotMedia | null>(props.initial)
  const [source, setSource] = useState<{ file: File; url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)
  const spec = IMAGE_SPECS[props.role]

  function update(next: SlotMedia | null) {
    setMedia(next)
    props.onChange?.(next)
  }

  async function upload(crop: PixelCrop) {
    if (!source) return
    const file = source.file
    URL.revokeObjectURL(source.url)
    setSource(null)
    setError(null)
    if (crop.width < spec.widths[0]) {
      setError(`Imagem muito pequena. Use pelo menos ${spec.widths[0]} px de largura.`)
      return
    }
    setStatus('sending')
    try {
      const [small, large] = await renderCrop(file, crop, props.role)
      const body = new FormData()
      body.set('role', props.role)
      body.set('vitrineId', props.vitrineId)
      if (props.itemId) body.set('itemId', props.itemId)
      if (props.position) body.set('position', String(props.position))
      body.set('small', small, 'small')
      body.set('large', large, 'large')
      const response = await fetch('/api/media/image', { method: 'POST', body })
      const result = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: string }
      if (!response.ok || !result.id || !result.url) {
        setError(result.error ?? 'Não foi possível enviar a imagem. Tente novamente.')
        return
      }
      update({ id: result.id, url: result.url })
    } catch {
      setError('Conexão caiu. Tente enviar de novo.')
    } finally {
      setStatus('idle')
    }
  }

  async function remove() {
    if (!media) return
    const response = await fetch(`/api/media/${media.id}`, { method: 'DELETE' })
    if (response.status === 204) update(null)
    else setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Não foi possível remover.')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{props.label}</span>
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={props.label} className="w-32 rounded-control border border-line object-cover" />
      ) : null}
      <input
        type="file"
        accept="image/*"
        aria-label={props.label}
        disabled={props.disabled || status === 'sending'}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) setSource({ file, url: URL.createObjectURL(file) })
        }}
      />
      {status === 'sending' ? <p className="text-sm" aria-live="polite">Enviando…</p> : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {media && props.removable ? (
        <Button variant="ghost" onClick={remove} className="self-start">
          Remover imagem
        </Button>
      ) : null}
      {source ? (
        <ImageCropper
          imageUrl={source.url}
          aspect={spec.aspect[0] / spec.aspect[1]}
          onCancel={() => {
            URL.revokeObjectURL(source.url)
            setSource(null)
          }}
          onConfirm={upload}
        />
      ) : null}
    </div>
  )
}

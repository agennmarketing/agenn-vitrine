'use client'

import { CircleAlert, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Spinner } from '@/components/ui/submit-button'
import { IMAGE_SPECS, type ImageRole } from '@/lib/media/image-specs'
import { renderCrop, type PixelCrop } from '@/lib/media/render-crop'
import { ImageCropper } from './image-cropper'

type SlotMedia = { id: string; url: string }

// Largura do cartão por papel: capa e galeria enchem a coluna; a logo fica num quadrado contido.
const TILE_WIDTH: Record<ImageRole, string> = {
  cover: 'w-full',
  gallery: 'w-full',
  banner: 'w-full',
  logo: 'w-36',
}

/*
 * Cartão de imagem: o próprio cartão é o alvo de toque (o input de arquivo cobre o cartão, transparente),
 * na proporção final do recorte. Estados: vazio, enviando, pronto (com "Trocar") e erro.
 */
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
  const [removing, setRemoving] = useState(false)
  const spec = IMAGE_SPECS[props.role]
  const sending = status === 'sending'
  const locked = props.disabled || sending

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
    setRemoving(true)
    setError(null)
    const response = await fetch(`/api/media/${media.id}`, { method: 'DELETE' }).catch(() => null)
    setRemoving(false)
    if (response?.status === 204) update(null)
    else setError(((await response?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? 'Não foi possível remover.')
  }

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${TILE_WIDTH[props.role]}`}>
      <div
        className={`@container group relative overflow-hidden rounded-card border-2 transition-colors duration-150 ease-out-quint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong ${
          error ? 'border-danger' : media ? 'border-line' : 'border-dashed border-line-strong'
        } ${media ? 'bg-subtle' : 'bg-canvas'} ${props.disabled ? 'opacity-60' : media ? '' : 'hover:border-go hover:bg-go-soft/60'}`}
        style={{ aspectRatio: `${spec.aspect[0]} / ${spec.aspect[1]}` }}
      >
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={props.label} className="absolute inset-0 size-full animate-fade object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-surface text-go-strong shadow-[0_3px_0_var(--color-line-strong)] group-hover:bg-go-soft"
            >
              <ImagePlus className="size-5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-extrabold leading-tight text-ink">{props.label}</span>
            <span className="hidden text-xs font-bold text-ink-muted @[8.5rem]:block">Toque para escolher</span>
          </span>
        )}

        {media ? (
          <>
            {/* Rótulo e "Trocar" embaixo da foto, sobre um véu para manter a leitura em qualquer imagem. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-deep/60 to-transparent"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1"
            >
              <span className="min-w-0 truncate rounded-full bg-deep/85 px-2.5 py-1 text-xs font-extrabold text-deep-ink">
                {props.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs font-extrabold text-ink shadow-[0_2px_0_rgb(11_42_28/0.18)]">
                <RefreshCw className="size-3" strokeWidth={3} />
                <span className="hidden @[9rem]:inline">Trocar</span>
              </span>
            </span>
          </>
        ) : null}

        <input
          type="file"
          accept="image/*"
          aria-label={props.label}
          disabled={locked}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) setSource({ file, url: URL.createObjectURL(file) })
          }}
          className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />

        {sending ? (
          <span className="absolute inset-0 z-20 flex animate-fade flex-col items-center justify-center gap-2 bg-surface/85 text-sm font-extrabold text-ink">
            <Spinner className="size-6 text-go-strong" />
            <span aria-live="polite">Enviando…</span>
          </span>
        ) : null}

        {media && props.removable && !sending ? (
          <button
            type="button"
            aria-label="Remover imagem"
            title="Remover imagem"
            disabled={removing}
            onClick={remove}
            className="absolute right-2 top-2 z-20 flex size-9 items-center justify-center rounded-full bg-surface text-danger shadow-[0_2px_0_rgb(11_42_28/0.2)] transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            {removing ? <Spinner className="size-4" /> : <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.75} />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="flex animate-rise items-start gap-1.5 text-sm font-bold leading-5 text-danger" role="alert">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
          <span>{error}</span>
        </p>
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

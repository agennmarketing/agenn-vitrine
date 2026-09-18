'use client'

import { CircleAlert, CircleCheck, Clapperboard, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/submit-button'
import { validateVideoFile } from '@/lib/video/rules'

type SlotMedia = { id: string; status: 'processing' | 'ready' | 'failed' }
type UploadTicket = { mode: 'tus'; endpoint: string; headers: Record<string, string> } | { mode: 'put'; url: string }

function readMetadata(file: File): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (value: { durationSeconds: number; width: number; height: number }) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timeout = setTimeout(() => done({ durationSeconds: Number.NaN, width: 0, height: 0 }), 15_000)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      clearTimeout(timeout)
      done({ durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      clearTimeout(timeout)
      done({ durationSeconds: Number.NaN, width: 0, height: 0 })
    }
    video.src = url
  })
}

function putWithProgress(url: string, file: File, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total)
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(String(request.status))))
    request.onerror = () => reject(new Error('rede'))
    request.send(file)
  })
}

export function VideoSlot(props: {
  label: string
  role: 'video' | 'banner'
  vitrineId: string
  itemId?: string | null
  initial: SlotMedia | null
  limits: { maxSeconds: number; maxUploadMb: number }
  disabled?: boolean
  onChange?: (media: SlotMedia | null) => void
}) {
  const [media, setMedia] = useState<SlotMedia | null>(props.initial)
  const [progress, setProgress] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onChangeRef = useRef(props.onChange)
  // Atualizado em efeito: escrever em ref durante a renderização é recusado pelo lint do React.
  useEffect(() => {
    onChangeRef.current = props.onChange
  })

  function update(next: SlotMedia | null) {
    setMedia(next)
    onChangeRef.current?.(next)
  }

  // Enquanto processa, consulta o status a cada 5 s.
  useEffect(() => {
    if (media?.status !== 'processing' || progress !== null) return
    const id = media.id
    const timer = setInterval(async () => {
      const response = await fetch(`/api/media/${id}`, { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) return
      const { status } = (await response.json()) as { status: SlotMedia['status'] }
      if (status !== 'processing') {
        setMedia({ id, status })
        onChangeRef.current?.({ id, status })
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [media, progress])

  async function onFile(file: File) {
    setError(null)
    setNotice(null)
    const meta = await readMetadata(file)
    const check = validateVideoFile({ ...meta, sizeBytes: file.size }, props.limits, props.role)
    if (!check.ok) {
      setError(check.message)
      return
    }

    const response = await fetch('/api/media/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: props.role,
        vitrineId: props.vitrineId,
        itemId: props.itemId ?? null,
        durationSeconds: meta.durationSeconds,
        sizeBytes: file.size,
        width: meta.width,
        height: meta.height,
      }),
    }).catch(() => null)
    const result = (await response?.json().catch(() => ({}))) as { id?: string; upload?: UploadTicket; error?: string }
    if (!response?.ok || !result.id || !result.upload) {
      setError(result.error ?? 'Não foi possível preparar o envio. Tente novamente.')
      return
    }

    const mediaId = result.id
    update({ id: mediaId, status: 'processing' })
    setProgress(0)
    try {
      if (result.upload.mode === 'put') {
        await putWithProgress(result.upload.url, file, setProgress)
      } else {
        const ticket = result.upload
        const tus = await import('tus-js-client')
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: ticket.endpoint,
            headers: ticket.headers,
            metadata: { filetype: file.type, title: file.name },
            retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
            // A retomada é por vídeo: sem isto, reenviar o mesmo arquivo "continuava" o envio
            // de um vídeo anterior e o novo ficava com 0 bytes no Bunny.
            fingerprint: async () => `bunny-stream-${ticket.headers.VideoId}`,
            removeFingerprintOnSuccess: true,
            onShouldRetry: (uploadError) => {
              const status = uploadError.originalResponse?.getStatus() ?? 0
              const retry = status === 0 || status >= 500 || status === 409 || status === 423 || status === 429
              if (retry) setNotice('Conexão caiu, retomando…')
              return retry
            },
            onProgress: (sent, total) => {
              setNotice(null)
              setProgress(total ? sent / total : 0)
            },
            onError: reject,
            onSuccess: () => resolve(),
          })
          upload.findPreviousUploads().then((previous) => {
            if (previous.length) upload.resumeFromPreviousUpload(previous[0])
            upload.start()
          })
        })
      }
      setProgress(null)
      setNotice(null)
    } catch (uploadError) {
      setProgress(null)
      const status = (uploadError as { originalResponse?: { getStatus(): number } | null }).originalResponse?.getStatus()
      setError(`Não foi possível enviar o vídeo${status ? ` (erro ${status})` : ''}. Tente novamente.`)
      await fetch(`/api/media/${mediaId}`, { method: 'DELETE' }).catch(() => null)
      update(null)
    }
  }

  async function remove() {
    if (!media) return
    const response = await fetch(`/api/media/${media.id}`, { method: 'DELETE' }).catch(() => null)
    if (response?.status === 204) update(null)
    else setError('Não foi possível remover o vídeo.')
  }

  const uploading = progress !== null
  const state: 'empty' | 'uploading' | 'processing' | 'ready' | 'failed' = uploading
    ? 'uploading'
    : media === null
      ? 'empty'
      : media.status
  const tone = {
    empty: 'border-dashed border-line-strong bg-canvas',
    uploading: 'border-line bg-surface',
    processing: 'border-line bg-surface',
    ready: 'border-go/50 bg-go-soft/50',
    failed: 'border-danger/40 bg-danger-soft/50',
  }[state]
  const iconTone = {
    empty: 'bg-surface text-go-strong shadow-[0_3px_0_var(--color-line-strong)]',
    uploading: 'bg-go-soft text-go-strong',
    processing: 'bg-sun-soft text-sun-ink',
    ready: 'bg-go text-go-ink shadow-[0_3px_0_var(--color-go-lip)]',
    failed: 'bg-danger-soft text-danger',
  }[state]

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`group relative flex min-h-20 items-center gap-3.5 rounded-card border-2 p-3 transition-colors duration-150 ease-out-quint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong ${tone} ${
          props.disabled ? 'opacity-60' : state === 'empty' ? 'hover:border-go hover:bg-go-soft/60' : ''
        }`}
      >
        <span aria-hidden="true" className={`flex size-14 shrink-0 items-center justify-center rounded-control ${iconTone}`}>
          {state === 'ready' ? (
            <CircleCheck className="size-7 animate-pop" strokeWidth={2.5} />
          ) : state === 'failed' ? (
            <CircleAlert className="size-7" strokeWidth={2.5} />
          ) : state === 'processing' ? (
            <Spinner className="size-6" />
          ) : state === 'uploading' ? (
            <Upload className="size-6" strokeWidth={2.75} />
          ) : (
            <Clapperboard className="size-6" strokeWidth={2.5} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-extrabold leading-tight text-ink">{props.label}</span>
          <div aria-live="polite" className="flex flex-col gap-1.5 text-sm font-bold leading-snug">
            {state === 'empty' ? <p className="text-ink-muted">Toque para escolher um vídeo</p> : null}
            {uploading ? (
              <>
                <p className="text-ink numeric">Enviando… {Math.round(progress * 100)}%</p>
                <span aria-hidden="true" className="block h-2.5 w-full overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-go transition-[width] duration-300 ease-out-quint"
                    style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                  />
                </span>
              </>
            ) : null}
            {notice ? <p className="text-sun-ink">{notice}</p> : null}
            {media?.status === 'processing' && !uploading ? <p className="text-ink-muted">Processando o vídeo…</p> : null}
            {media?.status === 'ready' ? <p className="text-go-strong">Vídeo pronto</p> : null}
            {media?.status === 'failed' ? <p className="text-danger">O processamento falhou.</p> : null}
          </div>
        </div>
        {media && !uploading ? (
          <Button
            variant={media.status === 'failed' ? 'secondary' : 'ghost'}
            size="sm"
            className={`shrink-0 ${media.status === 'failed' ? '' : 'text-danger hover:bg-danger-soft'}`}
            onClick={remove}
          >
            {media.status === 'failed' ? (
              <RotateCcw aria-hidden="true" className="size-4" strokeWidth={2.75} />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
            )}
            {media.status === 'failed' ? 'Tentar novamente' : 'Remover vídeo'}
          </Button>
        ) : null}
        {media === null || uploading ? (
          // O input cobre o cartão inteiro, transparente: o toque em qualquer ponto escolhe o arquivo.
          <input
            type="file"
            accept="video/*"
            aria-label={props.label}
            disabled={props.disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void onFile(file)
            }}
            className="absolute inset-0 z-10 size-full cursor-pointer rounded-card opacity-0 disabled:cursor-not-allowed"
          />
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="flex animate-rise items-start gap-1.5 text-sm font-bold leading-5 text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

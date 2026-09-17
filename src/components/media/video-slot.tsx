'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
            onShouldRetry: () => {
              setNotice('Conexão caiu, retomando…')
              return true
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
    } catch {
      setProgress(null)
      setError('Não foi possível enviar o vídeo. Tente novamente.')
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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{props.label}</span>
      {media === null || progress !== null ? (
        <input
          type="file"
          accept="video/*"
          aria-label={props.label}
          disabled={props.disabled || progress !== null}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onFile(file)
          }}
        />
      ) : null}
      <div aria-live="polite" className="text-sm">
        {progress !== null ? <p>Enviando… {Math.round(progress * 100)}%</p> : null}
        {notice ? <p>{notice}</p> : null}
        {media?.status === 'processing' && progress === null ? <p>Processando o vídeo…</p> : null}
        {media?.status === 'ready' ? <p>Vídeo pronto</p> : null}
        {media?.status === 'failed' ? <p className="text-danger">O processamento falhou.</p> : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {media && progress === null ? (
        <Button variant="ghost" className="self-start" onClick={remove}>
          {media.status === 'failed' ? 'Tentar novamente' : 'Remover vídeo'}
        </Button>
      ) : null}
    </div>
  )
}

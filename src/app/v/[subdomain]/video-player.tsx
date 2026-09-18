'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PublicVideo } from '@/features/public/build-catalog'
import { createUsageReporter } from './usage-reporter'

// hls.js só é importado aqui, e este componente só monta quando a mídia de vídeo
// está visível (spec 6.3). Ao desmontar: pausa, destrói e envia o consumo.
export function VideoPlayer({
  video,
  autoPlay = true,
  controls = false,
  showSoundToggle = true,
  className = '',
  wrapperClassName = '',
}: {
  video: PublicVideo
  autoPlay?: boolean
  controls?: boolean
  showSoundToggle?: boolean
  className?: string
  wrapperClassName?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const reporter = createUsageReporter(video.mediaId)
    let destroyHls: (() => void) | null = null
    let cancelled = false
    let lastTime = 0

    const onTimeUpdate = () => {
      const delta = element.currentTime - lastTime
      lastTime = element.currentTime
      reporter.addSeconds(delta)
    }

    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = video.playlistUrl
      element.addEventListener('timeupdate', onTimeUpdate)
      if (autoPlay) element.play().catch(() => undefined)
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        // Sem suporte a MSE nem HLS nativo: fica o poster do próprio <video>.
        if (!Hls.isSupported()) return
        const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 20 })
        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          const stats = data.frag.stats as { total?: number; loaded?: number }
          reporter.addBytes(stats.total || stats.loaded || 0)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // Erro fatal (rede, CDN): para o download e mantém o poster.
          if (data.fatal) hls.destroy()
        })
        hls.loadSource(video.playlistUrl)
        hls.attachMedia(element)
        if (autoPlay) element.play().catch(() => undefined)
        destroyHls = () => hls.destroy()
      })
    }

    return () => {
      cancelled = true
      element.removeEventListener('timeupdate', onTimeUpdate)
      element.pause()
      destroyHls?.()
      element.removeAttribute('src')
      element.load()
      reporter.flush()
    }
  }, [video.mediaId, video.playlistUrl, autoPlay])

  return (
    <div className={`relative ${wrapperClassName}`}>
      <video
        ref={ref}
        data-media-id={video.mediaId}
        poster={video.posterUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        controls={controls}
        className={className}
      />
      {showSoundToggle ? (
        <button
          type="button"
          onClick={() => {
            const next = !muted
            setMuted(next)
            if (ref.current) ref.current.muted = next
          }}
          className="absolute bottom-3 right-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-black/60 px-3.5 text-sm font-semibold text-white backdrop-blur transition-transform duration-150 active:scale-95"
        >
          {muted ? <VolumeX aria-hidden="true" className="size-4" strokeWidth={2.5} /> : <Volume2 aria-hidden="true" className="size-4" strokeWidth={2.5} />}
          {muted ? 'Ativar som' : 'Desativar som'}
        </button>
      ) : null}
    </div>
  )
}

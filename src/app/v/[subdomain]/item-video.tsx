'use client'

import type { MuxPlayerCSSProperties, MuxPlayerRefAttributes } from '@mux/mux-player-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { PublicVideo } from '@/features/public/build-catalog'
import { createUsageReporter } from './usage-reporter'

// O Mux Player só é baixado quando os detalhes de um item com vídeo abrem.
const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), { ssr: false })

const playerStyle: MuxPlayerCSSProperties = {
  '--media-object-fit': 'cover',
  '--media-background-color': 'transparent',
  aspectRatio: 'auto',
}

// Vídeo do item nos detalhes: começa sozinho e mudo uma única vez, sem loop; ao terminar
// fica parado no fim com o Play. Ao desmontar (fechar ou sair do slide), o mux-video sai do
// DOM, o que pausa o <video> e descarrega a fonte (unload no disconnectedCallback).
export function ItemVideo({ video, autoPlay, onPlay }: { video: PublicVideo; autoPlay: boolean; onPlay: () => void }) {
  const [initialAutoPlay] = useState(autoPlay)
  const reporterRef = useRef<ReturnType<typeof createUsageReporter> | null>(null)
  const lastTime = useRef(0)

  useEffect(() => {
    const reporter = createUsageReporter(video.mediaId)
    reporterRef.current = reporter
    return () => {
      reporter.flush()
      reporterRef.current = null
    }
  }, [video.mediaId])

  return (
    <div className="relative size-full bg-black">
      {/* Poster fixo por baixo: aparece enquanto o player carrega, sem mudar o tamanho. */}
      {video.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <MuxPlayer
        data-media-id={video.mediaId}
        src={video.playlistUrl}
        poster={video.posterUrl ?? undefined}
        streamType="on-demand"
        autoPlay={initialAutoPlay ? 'muted' : false}
        muted
        playsInline
        loop={false}
        preload="metadata"
        capRenditionToPlayerSize
        disableCookies
        accentColor="#ffffff"
        onPlay={onPlay}
        onTimeUpdate={(event) => {
          const current = (event.target as MuxPlayerRefAttributes).currentTime
          reporterRef.current?.addSeconds(current - lastTime.current)
          lastTime.current = current
        }}
        className="absolute inset-0 size-full"
        style={playerStyle}
      />
    </div>
  )
}

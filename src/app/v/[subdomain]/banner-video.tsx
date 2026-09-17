'use client'

import { useEffect, useState } from 'react'
import type { PublicVideo } from '@/features/public/build-catalog'
import { VideoPlayer } from './video-player'

// Spec 6.3: poster primeiro; o vídeo só começa depois do carregamento da página.
// Com Save-Data ou prefers-reduced-motion, fica só o poster.
export function BannerVideo({ video }: { video: PublicVideo }) {
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (saveData || reducedMotion) return
    const start = () => setPlay(true)
    if (document.readyState === 'complete') {
      const timer = setTimeout(start, 0)
      return () => clearTimeout(timer)
    }
    window.addEventListener('load', start, { once: true })
    return () => window.removeEventListener('load', start)
  }, [])

  const className = 'aspect-video w-full rounded-card object-cover'
  if (!play) {
    // eslint-disable-next-line @next/next/no-img-element
    return video.posterUrl ? <img src={video.posterUrl} alt="" fetchPriority="high" className={className} /> : null
  }
  return <VideoPlayer video={video} showSoundToggle={false} className={className} />
}

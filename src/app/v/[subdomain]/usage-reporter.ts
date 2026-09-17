import { estimateBytesFromSeconds } from '@/lib/video/rules'

const REPORT_EVERY_MS = 15_000

// Envia a cada 15 s e ao fechar: bytes medidos pelo hls.js ou, no HLS nativo,
// estimativa por segundos assistidos. "seconds" é o tempo de relógio desde o último envio,
// usado no servidor como teto.
export function createUsageReporter(mediaId: string) {
  let bytes = 0
  let watchedSeconds = 0
  let since = Date.now()

  function send(final: boolean) {
    const seconds = (Date.now() - since) / 1000
    const total = bytes > 0 ? bytes : estimateBytesFromSeconds(watchedSeconds)
    bytes = 0
    watchedSeconds = 0
    since = Date.now()
    if (total <= 0) return
    const body = JSON.stringify({ mediaId, bytes: total, seconds })
    if (final && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/video-usage', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/video-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  }

  const timer = setInterval(() => send(false), REPORT_EVERY_MS)
  return {
    addBytes(value: number) {
      if (Number.isFinite(value) && value > 0) bytes += value
    },
    addSeconds(value: number) {
      if (Number.isFinite(value) && value > 0 && value < 5) watchedSeconds += value
    },
    flush() {
      clearInterval(timer)
      send(true)
    },
  }
}

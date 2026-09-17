export type VideoAspect = '9:16' | '16:9'
export type MediaStatus = 'processing' | 'ready' | 'failed'

export function aspectFor(width: number, height: number): VideoAspect {
  return width >= height ? '16:9' : '9:16'
}

export function validateVideoFile(
  meta: { durationSeconds: number; sizeBytes: number; width: number; height: number },
  limits: { maxSeconds: number; maxUploadMb: number },
  role: 'video' | 'banner',
): { ok: true; aspect: VideoAspect; durationSeconds: number } | { ok: false; message: string } {
  const readable =
    Number.isFinite(meta.durationSeconds) && meta.durationSeconds > 0 && meta.width > 0 && meta.height > 0
  if (!readable) return { ok: false, message: 'Não foi possível ler o vídeo. Tente outro arquivo.' }
  if (meta.durationSeconds > limits.maxSeconds + 0.5) {
    return { ok: false, message: `O vídeo tem ${Math.round(meta.durationSeconds)} s. O limite é ${limits.maxSeconds} s.` }
  }
  if (meta.sizeBytes > limits.maxUploadMb * 1024 * 1024) {
    return {
      ok: false,
      message: `O arquivo tem ${Math.ceil(meta.sizeBytes / (1024 * 1024))} MB. O limite é ${limits.maxUploadMb} MB.`,
    }
  }
  if (role === 'banner' && meta.height > meta.width) {
    return { ok: false, message: 'O banner em vídeo precisa ser horizontal.' }
  }
  return { ok: true, aspect: aspectFor(meta.width, meta.height), durationSeconds: Math.round(meta.durationSeconds) }
}

// Códigos do webhook do Bunny Stream: 3 = pronto, 4 = já tocável em uma resolução,
// 5 = falha na codificação, 8 = falha no envio pré-assinado.
export function bunnyStatusToMedia(status: number): MediaStatus {
  if (status === 3 || status === 4) return 'ready'
  if (status === 5 || status === 8) return 'failed'
  return 'processing'
}

// Teto por segundo: 720p do Bunny fica abaixo de 4 Mbps; a margem cobre o buffer à frente.
export const MAX_VIDEO_BITRATE_BPS = 4_000_000
export const NATIVE_HLS_ESTIMATED_BPS = 2_800_000
export const MAX_REPORT_SECONDS = 120

export function clampReportedBytes(bytes: number, seconds: number): number {
  if (!Number.isFinite(bytes) || !Number.isFinite(seconds) || bytes <= 0 || seconds <= 0) return 0
  const ceiling = Math.ceil((Math.min(seconds, MAX_REPORT_SECONDS) * MAX_VIDEO_BITRATE_BPS * 1.5) / 8)
  return Math.min(Math.round(bytes), ceiling)
}

export function estimateBytesFromSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.round((seconds * NATIVE_HLS_ESTIMATED_BPS) / 8)
}

export function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
}

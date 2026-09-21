import 'server-only'
import { getVideoServiceEnv } from '@/lib/server-env'
import type { MediaStatus } from './rules'
import { createFakeVideoService } from './fake-video'
import { createMuxVideoService } from './mux'

/** Endereço do envio direto do navegador. As credenciais nunca saem do servidor. */
export type VideoUpload = { uploadId: string; url: string }

/** Ponteiros guardados em `media`. O upload existe antes do asset. */
export type VideoRef = { uploadId: string | null; assetId: string | null }

export type VideoInfo = {
  assetId: string | null
  playbackId: string | null
  status: MediaStatus
  durationSeconds: number
  width: number
  height: number
}

export type UploadInput = {
  title: string
  corsOrigin: string
  /** Metadados lidos no navegador; o provedor confirma os reais quando o vídeo fica pronto. */
  durationSeconds: number
  width: number
  height: number
}

// Único ponto de contato com o provedor de vídeo. O resto do sistema só usa isto.
export interface VideoService {
  upload(input: UploadInput): Promise<VideoUpload>
  status(ref: VideoRef): Promise<VideoInfo | null>
  delete(assetId: string): Promise<void>
  playbackUrl(playbackId: string): string
  thumbnail(playbackId: string): string
}

export function getVideoService(): VideoService {
  const config = getVideoServiceEnv()
  return config.driver === 'fake' ? createFakeVideoService() : createMuxVideoService(config)
}

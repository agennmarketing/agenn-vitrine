import 'server-only'
import { muxStatusToMedia } from './rules'
import { videoPlaylistUrl, videoThumbnailUrl } from './urls'
import type { VideoInfo, VideoService } from './video-service'

const API = 'https://api.mux.com/video/v1'
export const MUX_STREAM_BASE = 'https://stream.mux.com'
export const MUX_IMAGE_BASE = 'https://image.mux.com'

type MuxAsset = {
  id: string
  status: string
  duration?: number
  playback_ids?: { id: string; policy: string }[]
  tracks?: { type: string; max_width?: number; max_height?: number }[]
}

type MuxUpload = { id: string; url: string; status: string; asset_id?: string }

const UPLOAD_FAILED = new Set(['errored', 'cancelled', 'timed_out'])
const FAILED: VideoInfo = { assetId: null, playbackId: null, status: 'failed', durationSeconds: 0, width: 0, height: 0 }
const PENDING: VideoInfo = { assetId: null, playbackId: null, status: 'processing', durationSeconds: 0, width: 0, height: 0 }

export function createMuxVideoService(config: { tokenId: string; tokenSecret: string }): VideoService {
  const authorization = `Basic ${Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString('base64')}`

  async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization, accept: 'application/json', ...init?.headers },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Mux ${init?.method ?? 'GET'} ${path} ${response.status}`)
    if (response.status === 204) return null
    const { data } = (await response.json()) as { data: T }
    return data
  }

  async function assetInfo(assetId: string): Promise<VideoInfo | null> {
    const asset = await call<MuxAsset>(`/assets/${assetId}`)
    if (!asset) return null
    const track = asset.tracks?.find((item) => item.type === 'video')
    return {
      assetId: asset.id,
      playbackId: asset.playback_ids?.find((item) => item.policy === 'public')?.id ?? null,
      status: muxStatusToMedia(asset.status),
      durationSeconds: Math.round(asset.duration ?? 0),
      width: track?.max_width ?? 0,
      height: track?.max_height ?? 0,
    }
  }

  return {
    async upload({ title, corsOrigin }) {
      const upload = await call<MuxUpload>('/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cors_origin: corsOrigin,
          // Basic: a qualidade mais barata do Mux, suficiente para a vitrine.
          new_asset_settings: { video_quality: 'basic', playback_policies: ['public'], passthrough: title.slice(0, 255) },
        }),
      })
      if (!upload?.id || !upload.url) throw new Error('Mux não devolveu o endereço de envio')
      return { uploadId: upload.id, url: upload.url }
    },

    async status({ uploadId, assetId }) {
      if (assetId) return assetInfo(assetId)
      if (!uploadId) return null
      // O asset só nasce quando o arquivo termina de subir: até lá, o estado vem do upload.
      const upload = await call<MuxUpload>(`/uploads/${uploadId}`)
      if (!upload) return null
      if (UPLOAD_FAILED.has(upload.status)) return FAILED
      if (!upload.asset_id) return PENDING
      return assetInfo(upload.asset_id)
    },

    async delete(assetId) {
      await call(`/assets/${assetId}`, { method: 'DELETE' })
    },

    playbackUrl: (playbackId) => videoPlaylistUrl(MUX_STREAM_BASE, playbackId),
    thumbnail: (playbackId) => videoThumbnailUrl(MUX_IMAGE_BASE, playbackId),
  }
}

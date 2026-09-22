import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { aspectFor, type MediaStatus } from '@/lib/video/rules'
import { getVideoService } from '@/lib/video/video-service'
import { revalidateVitrine } from '@/lib/vitrines/cache'

export const SYNC_MEDIA_COLUMNS =
  'id, owner_id, item_id, role, status, mux_upload_id, mux_asset_id, vitrines!media_vitrine_id_fkey(subdomain)'

export type SyncableMedia = {
  id: string
  owner_id: string
  item_id: string | null
  role: string
  status: string
  mux_upload_id: string | null
  mux_asset_id: string | null
  vitrines: unknown
}

type MediaUpdate = {
  status: MediaStatus
  mux_asset_id?: string
  mux_playback_id?: string
  thumbnail_url?: string
  duration_seconds?: number
  width?: number
  height?: number
  aspect?: '9:16' | '16:9'
}

// Consulta o vídeo no provedor e atualiza a mídia. Usado pelo webhook do Mux e pela
// consulta de status do painel, que assim não depende só do aviso.
export async function syncVideoStatus(admin: SupabaseClient<Database>, media: SyncableMedia): Promise<MediaStatus> {
  const current = media.status as MediaStatus
  if (!media.mux_upload_id && !media.mux_asset_id) return current

  const videos = getVideoService()
  const info = await videos.status({ uploadId: media.mux_upload_id, assetId: media.mux_asset_id })

  let update: MediaUpdate
  if (!info) {
    update = { status: 'failed' }
  } else if (info.status !== 'ready' || !info.assetId || !info.playbackId) {
    update = { status: info.status === 'ready' ? 'processing' : info.status }
    if (info.assetId) update.mux_asset_id = info.assetId
  } else {
    const { data: planId } = await admin.rpc('effective_plan_id', { p_user_id: media.owner_id })
    const { data: plan } = await admin.from('plans').select('max_video_seconds').eq('id', planId ?? 'essencial').single()
    if (plan && info.durationSeconds > plan.max_video_seconds + 1) {
      await videos.delete(info.assetId)
      update = { status: 'failed' }
    } else {
      update = {
        status: 'ready',
        mux_asset_id: info.assetId,
        mux_playback_id: info.playbackId,
        thumbnail_url: videos.thumbnail(info.playbackId),
        duration_seconds: info.durationSeconds,
        width: info.width,
        height: info.height,
        aspect: aspectFor(info.width, info.height),
      }
    }
  }

  // Nada mudou e nada novo a guardar: poupa a escrita.
  if (update.status === current && update.status !== 'ready' && !update.mux_asset_id) return current

  const { error } = await admin.from('media').update(update).eq('id', media.id)
  if (error) throw error

  const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
  const visibleChange = update.status === 'ready' || current === 'ready'
  if (subdomain && visibleChange && (media.item_id || media.role === 'banner')) revalidateVitrine(subdomain)

  return update.status
}

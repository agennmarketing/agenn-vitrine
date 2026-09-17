import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { aspectFor, bunnyStatusToMedia, type MediaStatus } from '@/lib/video/rules'
import { getVideoStream } from '@/lib/video/stream'
import { revalidateVitrine } from '@/lib/vitrines/cache'

export const SYNC_MEDIA_COLUMNS = 'id, owner_id, item_id, role, status, bunny_video_id, vitrines!media_vitrine_id_fkey(subdomain)'

export type SyncableMedia = {
  id: string
  owner_id: string
  item_id: string | null
  role: string
  status: string
  bunny_video_id: string | null
  vitrines: unknown
}

// Consulta o vídeo na API do Stream e atualiza a mídia. Usado pelo webhook do Bunny
// (spec 6.2.4) e pela consulta de status do painel, que assim não depende só do webhook.
export async function syncVideoStatus(admin: SupabaseClient<Database>, media: SyncableMedia): Promise<MediaStatus> {
  const current = media.status as MediaStatus
  if (!media.bunny_video_id) return current

  const stream = getVideoStream()
  const video = await stream.getVideo(media.bunny_video_id)

  let update: { status: MediaStatus; duration_seconds?: number; width?: number; height?: number; aspect?: '9:16' | '16:9' }
  if (!video) {
    update = { status: 'failed' }
  } else {
    const status = bunnyStatusToMedia(video.status)
    if (status !== 'ready') {
      update = { status }
    } else {
      const { data: planId } = await admin.rpc('effective_plan_id', { p_user_id: media.owner_id })
      const { data: plan } = await admin.from('plans').select('max_video_seconds').eq('id', planId ?? 'free').single()
      if (plan && video.length > plan.max_video_seconds + 1) {
        await stream.deleteVideo(video.guid)
        update = { status: 'failed' }
      } else {
        update = {
          status: 'ready',
          duration_seconds: video.length,
          width: video.width,
          height: video.height,
          aspect: aspectFor(video.width, video.height),
        }
      }
    }
  }

  if (update.status === current && update.status !== 'ready') return current

  const { error } = await admin.from('media').update(update).eq('id', media.id)
  if (error) throw error

  const subdomain = (media.vitrines as { subdomain: string } | null)?.subdomain
  const visibleChange = update.status === 'ready' || current === 'ready'
  if (subdomain && visibleChange && (media.item_id || media.role === 'banner')) revalidateVitrine(subdomain)

  return update.status
}

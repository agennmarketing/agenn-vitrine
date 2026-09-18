import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send-email'
import { buildVideoCleanupEmail } from '@/lib/email/video-cleanup-email'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import { deleteMediaRows } from '@/lib/media/remove-media'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'

type Admin = SupabaseClient<Database>

const DAY_MS = 86_400_000
const WARN_DAYS = 83
const DELETE_DAYS = 90
const BATCH = 100

// Spec 6.4: o aviso sai no dia 83, sete dias antes de apagar.
export async function warnVideoCleanup(admin: Admin): Promise<number> {
  const { data: accounts, error } = await admin.rpc('accounts_to_warn_video_cleanup', { p_warn_days: WARN_DAYS })
  if (error) throw error

  let sent = 0
  for (const account of accounts ?? []) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(account.user_id)
      if (userError) throw userError
      const email = userData.user?.email
      if (!email) continue

      const { data: profile } = await admin.from('profiles').select('name').eq('id', account.user_id).maybeSingle()
      const proEndedAt = new Date(account.pro_ended_at)
      const message = buildVideoCleanupEmail({
        ownerName: profile?.name ?? '',
        videosCount: account.videos_to_delete,
        proEndedAt,
        deleteAt: new Date(proEndedAt.getTime() + DELETE_DAYS * DAY_MS),
        panelUrl: buildAppUrl('/painel/plano', env.NEXT_PUBLIC_ROOT_DOMAIN),
      })
      await sendEmail({
        to: email,
        ...message,
        idempotencyKey: `video-cleanup-${account.user_id}-${proEndedAt.toISOString().slice(0, 10)}`,
      })
      sent++
    } catch (error) {
      // Um e-mail que falha não pode parar a fila.
      Sentry.captureException(error)
      console.error('[cron] falha ao avisar sobre a limpeza de vídeos', account.user_id, error)
    }
  }
  return sent
}

// Spec 6.4: 90 dias depois do fim do Pro, os vídeos que passam do limite do
// gratuito saem do banco e do Bunny. O primeiro vídeo fica (spec 4.7).
export async function deleteVideosAfterPro(admin: Admin): Promise<number> {
  const { data: rows, error } = await admin.rpc('videos_to_delete_after_pro', { p_days: DELETE_DAYS })
  if (error) throw error

  const list = rows ?? []
  for (let start = 0; start < list.length; start += BATCH) {
    await deleteMediaRows(admin, list.slice(start, start + BATCH))
  }
  revalidateVitrine(...list.map((row) => row.subdomain))
  return list.length
}

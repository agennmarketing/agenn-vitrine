import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getBilling } from '@/lib/billing/billing'
import { removeStoredFiles, removeStreamVideos } from '@/lib/media/remove-media'
import { storagePathList } from '@/lib/media/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const ALREADY_OVER = new Set(['canceled', 'incomplete_expired', 'none'])

// Spec 8.8: cancela a assinatura no Stripe e apaga dados e mídias.
// A ordem importa: se o cancelamento falhar, nada é apagado e o dono tenta de novo —
// apagar antes deixaria uma assinatura cobrando sem dono.
export async function deleteAccount(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient()

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (subscriptionError) throw subscriptionError

  if (subscription?.stripe_subscription_id && !ALREADY_OVER.has(subscription.status)) {
    await getBilling().cancelSubscription(subscription.stripe_subscription_id)
  }

  const [{ data: mediaRows, error: mediaError }, { data: vitrines, error: vitrinesError }] = await Promise.all([
    admin.from('media').select('storage_paths, bunny_video_id').eq('owner_id', userId),
    admin.from('vitrines').select('subdomain').eq('owner_id', userId),
  ])
  if (mediaError) throw mediaError
  if (vitrinesError) throw vitrinesError

  // Apagar o usuário derruba, em cascata, perfil, vitrines, itens, mídias, códigos,
  // complementos, pedidos e assinatura (conferido em 11_account_deletion.test.sql).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error

  await Promise.all([
    removeStoredFiles((mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))),
    removeStreamVideos((mediaRows ?? []).flatMap((row) => (row.bunny_video_id ? [row.bunny_video_id] : []))),
  ])
  revalidateVitrine(...(vitrines ?? []).map((vitrine) => vitrine.subdomain))
  Sentry.captureMessage(`Conta excluída: ${userId}`)
}

import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getBilling } from '@/lib/billing/billing'
import { removeStoredFiles, removeVideoAssets } from '@/lib/media/remove-media'
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
    admin.from('media').select('storage_paths, mux_upload_id, mux_asset_id').eq('owner_id', userId),
    admin.from('vitrines').select('subdomain').eq('owner_id', userId),
  ])
  if (mediaError) throw mediaError
  if (vitrinesError) throw vitrinesError

  const paths = (mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))
  const videos = (mediaRows ?? []).filter((row) => row.mux_upload_id || row.mux_asset_id)

  // Rastro para a limpeza diária de órfãos: se o processo morrer logo após apagar o
  // usuário, a linha de `media` que apontava para esses arquivos já não existe
  // mais, e a limpeza (que parte das linhas de `media`) nunca os encontraria sozinha.
  const trace = `Excluindo conta ${userId}: ${paths.length} arquivos, ${videos.length} vídeos`
  Sentry.captureMessage(trace)
  console.error(trace)

  // Apagar o usuário derruba, em cascata, perfil, vitrines, itens, mídias, códigos,
  // pedidos e assinatura (conferido em 11_account_deletion.test.sql).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error

  // Revalida assim que o dono deixa de existir, antes de mexer nos provedores: se as chamadas
  // de rede abaixo falharem, a vitrine já não continua servida do cache de um dono apagado.
  revalidateVitrine(...(vitrines ?? []).map((vitrine) => vitrine.subdomain))

  await Promise.all([removeStoredFiles(paths), removeVideoAssets(videos)])
  Sentry.captureMessage(`Conta excluída: ${userId}`)
}

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { subscriptionRowFrom } from '@/lib/billing/status'
import type { BillingSubscription } from '@/lib/billing/types'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'

type Admin = SupabaseClient<Database>

// O dono vem do metadata da assinatura; se faltar, pelo Customer já guardado.
export async function resolveUserId(admin: Admin, subscription: BillingSubscription): Promise<string | null> {
  if (subscription.userId) return subscription.userId
  const { data, error } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customerId)
    .maybeSingle()
  if (error) throw error
  return data?.user_id ?? null
}

// Spec 9: toda mudança de plano grava a assinatura, ajusta o status das vitrines e
// revalida todas elas (a página gerada depende do plano).
export async function applySubscription(
  admin: Admin,
  userId: string,
  subscription: BillingSubscription,
  now: Date = new Date(),
): Promise<string[]> {
  const { data: previous, error: previousError } = await admin
    .from('subscriptions')
    .select('status, grace_until, pro_ended_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (previousError) throw previousError

  const row = subscriptionRowFrom(subscription, previous ?? null, now)
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: subscription.customerId,
    stripe_subscription_id: subscription.id,
    ...row,
  })
  if (error) throw error

  const { data: subdomains, error: syncError } = await admin.rpc('sync_vitrine_status', { p_user_id: userId })
  if (syncError) throw syncError

  const list = subdomains ?? []
  revalidateVitrine(...list)
  return list
}

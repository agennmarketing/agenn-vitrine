import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBilling } from '@/lib/billing/billing'
import { isPaidNow } from '@/lib/billing/status'
import type { Database } from '@/lib/supabase/database.types'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { applySubscription } from './apply-subscription'

type Admin = SupabaseClient<Database>

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return !a && !b
  return new Date(a).getTime() === new Date(b).getTime()
}

// Spec 10: se um webhook se perder, a conferência diária corrige.
export async function reconcileSubscriptions(admin: Admin, limit = 500): Promise<{ checked: number; updated: number }> {
  const { data: rows, error } = await admin
    .from('subscriptions')
    .select('user_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, grace_until')
    .not('stripe_subscription_id', 'is', null)
    .limit(limit)
  if (error) throw error

  const billing = getBilling()
  let updated = 0

  for (const row of rows ?? []) {
    try {
      const subscription = await billing.getSubscription(row.stripe_subscription_id!)
      if (!subscription) continue

      const unchanged =
        subscription.status === row.status &&
        subscription.cancelAtPeriodEnd === row.cancel_at_period_end &&
        sameInstant(subscription.currentPeriodEnd, row.current_period_end)

      if (unchanged) {
        // A carência vence com o tempo, sem evento novo: o bloqueio também.
        if (row.status === 'past_due' && !isPaidNow(row, new Date())) {
          const { error: statusError } = await admin
            .from('subscriptions')
            .update({ subscription_status: 'canceled' })
            .eq('user_id', row.user_id)
          if (statusError) throw statusError
          const { data: subdomains, error: syncError } = await admin.rpc('sync_vitrine_status', {
            p_user_id: row.user_id,
          })
          if (syncError) throw syncError
          revalidateVitrine(...(subdomains ?? []))
        }
        continue
      }

      await applySubscription(admin, row.user_id, subscription)
      updated++
    } catch (error) {
      // Uma assinatura com problema não pode parar a fila.
      Sentry.captureException(error)
      console.error('[cron] falha ao conferir assinatura', row.stripe_subscription_id, error)
    }
  }

  return { checked: rows?.length ?? 0, updated }
}

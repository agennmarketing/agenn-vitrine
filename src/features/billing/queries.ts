import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getPanelSession } from '@/features/vitrines/queries'
import { getBilling } from '@/lib/billing/billing'
import type { SubscriptionView } from '@/lib/billing/status'
import type { BillingPrice } from '@/lib/billing/types'

export async function getMySubscription(): Promise<SubscriptionView | null> {
  const { supabase, userId } = await getPanelSession()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status, interval, current_period_end, cancel_at_period_end, grace_until, pro_ended_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    interval: data.interval === 'month' || data.interval === 'year' ? data.interval : null,
  }
}

// Preço indisponível não pode derrubar a tela: os botões aparecem sem valor.
export async function getPlanPrices(): Promise<BillingPrice[]> {
  try {
    return await getBilling().listPrices()
  } catch (error) {
    Sentry.captureException(error)
    return []
  }
}

export type BillingInterval = 'month' | 'year'

// Espelho dos status do Stripe (spec 9).
export type BillingStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

export type BillingSubscription = {
  id: string
  customerId: string
  /** Vem de `subscription.metadata.user_id`; nulo quando o Stripe não tem o dado. */
  userId: string | null
  status: BillingStatus
  interval: BillingInterval | null
  /** ISO; na API 2026-08-26 o período vive no item da assinatura. */
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export type BillingPrice = { id: string; interval: BillingInterval; amountCents: number }

export type BillingEvent = { id: string; type: string; subscriptionId: string | null; customerId: string | null }

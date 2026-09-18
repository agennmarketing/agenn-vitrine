import 'server-only'
import { getBillingEnv } from '@/lib/server-env'
import { createFakeBilling } from './fake-billing'
import { createStripeBilling } from './stripe-billing'
import type { BillingEvent, BillingInterval, BillingPrice, BillingSubscription } from './types'

export interface Billing {
  /** Devolve o id do Customer, criando um com `metadata.user_id` na primeira vez (spec 9). */
  ensureCustomer(input: { userId: string; email: string; name: string; customerId: string | null }): Promise<string>
  createCheckoutSession(input: {
    userId: string
    customerId: string
    priceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<string>
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string>
  getSubscription(subscriptionId: string): Promise<BillingSubscription | null>
  /** Spec 8.8: excluir a conta cancela a assinatura, mas mantém o Customer (histórico fiscal). */
  cancelSubscription(subscriptionId: string): Promise<void>
  listPrices(): Promise<BillingPrice[]>
  parseEvent(raw: string, signature: string | null): Promise<BillingEvent | null>
  priceIdFor(interval: BillingInterval): string
}

export function getBilling(): Billing {
  const config = getBillingEnv()
  return config.driver === 'fake' ? createFakeBilling(config) : createStripeBilling(config)
}

import 'server-only'
import Stripe from 'stripe'
import type { BillingEnv } from '@/lib/server-env-schema'
import type { Billing } from './billing'
import { createStripeClient, parseStripeEvent } from './stripe-events'
import type { BillingInterval, BillingPrice, BillingStatus, BillingSubscription } from './types'

const PRICE_TTL_MS = 60 * 60 * 1000
let priceCache: { at: number; prices: BillingPrice[] } | null = null

function intervalOf(value: string | null | undefined): BillingInterval | null {
  return value === 'month' || value === 'year' ? value : null
}

function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

// Spec 9 / API 2026-08-26: o período vive no item da assinatura, não no topo.
export function normalizeSubscription(subscription: Stripe.Subscription): BillingSubscription {
  const item = subscription.items.data[0]
  return {
    id: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    userId: subscription.metadata?.user_id ?? null,
    status: subscription.status as BillingStatus,
    interval: intervalOf(item?.price.recurring?.interval ?? null),
    currentPeriodEnd: toIso(item?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  }
}

export function createStripeBilling(config: BillingEnv): Billing {
  const stripe = createStripeClient(config.secretKey)

  return {
    priceIdFor: (interval) => (interval === 'year' ? config.priceYear : config.priceMonth),

    async ensureCustomer({ userId, email, name, customerId }) {
      if (customerId) return customerId
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: name.trim() || undefined,
        metadata: { user_id: userId },
      })
      return customer.id
    },

    async createCheckoutSession({ userId, customerId, priceId, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: priceId, quantity: 1 }],
        // Spec 9: pagamento só com cartão.
        payment_method_types: ['card'],
        locale: 'pt-BR',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: { metadata: { user_id: userId } },
      })
      if (!session.url) throw new Error('Checkout criado sem URL')
      return session.url
    },

    async createPortalSession({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: 'pt-BR',
      })
      return session.url
    },

    async getSubscription(subscriptionId) {
      try {
        return normalizeSubscription(await stripe.subscriptions.retrieve(subscriptionId))
      } catch (error) {
        // Assinatura apagada no Stripe: não é falha nossa.
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return null
        throw error
      }
    },

    async cancelSubscription(subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId)
      } catch (error) {
        // Já cancelada ou inexistente: o objetivo (não cobrar mais) está cumprido.
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return
        throw error
      }
    },

    // Cache no processo: reajuste no Stripe aparece em até 1 h, sem uma chamada por visita.
    async listPrices() {
      if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.prices
      const prices = await Promise.all([config.priceMonth, config.priceYear].map((id) => stripe.prices.retrieve(id)))
      const list = prices.flatMap((price) => {
        const interval = intervalOf(price.recurring?.interval ?? null)
        return interval !== null && price.unit_amount !== null
          ? [{ id: price.id, interval, amountCents: price.unit_amount }]
          : []
      })
      priceCache = { at: Date.now(), prices: list }
      return list
    },

    parseEvent: (raw, signature) => parseStripeEvent(stripe, raw, signature, config.webhookSecret),
  }
}

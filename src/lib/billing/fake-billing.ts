import 'server-only'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getBillingEnv } from '@/lib/server-env'
import type { BillingEnv } from '@/lib/server-env-schema'
import type { Billing } from './billing'
import { createStripeClient, parseStripeEvent } from './stripe-events'
import type { BillingInterval, BillingPrice, BillingSubscription } from './types'

// Só CI e desenvolvimento: clientes, assinaturas e sessões viram arquivos JSON no
// diretório temporário, como o driver falso de vídeo da Fase 3.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-billing')
const ID = /^[a-z]+_fake_[0-9a-f-]{36}$/

export const FAKE_PRICE_MONTH = 'price_fake_mes'

const FAKE_PRICES: BillingPrice[] = [{ id: FAKE_PRICE_MONTH, interval: 'month', amountCents: 6990 }]

export type FakeCheckoutSession = {
  id: string
  userId: string
  customerId: string
  interval: BillingInterval
  successUrl: string
}

function fileFor(id: string) {
  if (!ID.test(id)) throw new Error(`id falso inválido: ${id}`)
  return path.join(ROOT, `${id}.json`)
}

async function read<T>(id: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(fileFor(id), 'utf8')) as T
  } catch {
    return null
  }
}

async function write(id: string, value: unknown) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(fileFor(id), JSON.stringify(value))
}

export function readFakeSession(id: string) {
  return read<FakeCheckoutSession>(id)
}

export async function writeFakeSubscription(subscription: BillingSubscription) {
  await write(subscription.id, subscription)
}

export async function findFakeSubscriptionByCustomer(customerId: string): Promise<BillingSubscription | null> {
  const files = await readdir(ROOT).catch(() => [] as string[])
  const subscriptions = await Promise.all(
    files
      .filter((file) => file.startsWith('sub_fake_'))
      .map((file) => read<BillingSubscription>(file.replace(/\.json$/, ''))),
  )
  return subscriptions.find((subscription) => subscription?.customerId === customerId) ?? null
}

// Faz o papel do Stripe: monta o evento assinado e chama o mesmo processamento da
// rota do webhook. Em processo, e não por HTTP: o servidor chamar a si mesmo trava
// no CI (o `next start` fica esperando a própria resposta).
export async function sendFakeWebhook(type: string, object: Record<string, unknown>): Promise<void> {
  const config = getBillingEnv()
  const stripe = createStripeClient(config.secretKey)
  const body = JSON.stringify({
    id: `evt_fake_${crypto.randomUUID()}`,
    object: 'event',
    type,
    data: { object },
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret })
  // Import tardio: a rota e o driver se referenciam, e isto quebra o ciclo estático.
  const { processStripeEvent } = await import('@/features/billing/process-event')
  const result = await processStripeEvent(body, signature)
  if (result.status >= 400) throw new Error(`webhook falso respondeu ${result.status}`)
}

export function createFakeBilling(config: BillingEnv): Billing {
  const stripe = createStripeClient(config.secretKey)

  return {
    priceId: () => FAKE_PRICE_MONTH,

    async ensureCustomer({ customerId }) {
      return customerId ?? `cus_fake_${crypto.randomUUID()}`
    },

    async createCheckoutSession({ userId, customerId, successUrl }) {
      const id = `cs_fake_${crypto.randomUUID()}`
      const session: FakeCheckoutSession = {
        id,
        userId,
        customerId,
        interval: 'month',
        successUrl,
      }
      await write(id, session)
      return `/api/dev-billing/checkout?sessao=${id}`
    },

    async createPortalSession({ customerId, returnUrl }) {
      return `/api/dev-billing/portal?cliente=${customerId}&retorno=${encodeURIComponent(returnUrl)}`
    },

    getSubscription: (subscriptionId) => read<BillingSubscription>(subscriptionId),

    async cancelSubscription(subscriptionId) {
      const subscription = await read<BillingSubscription>(subscriptionId)
      if (!subscription) return
      await writeFakeSubscription({ ...subscription, status: 'canceled', cancelAtPeriodEnd: false })
    },

    async listPrices() {
      return FAKE_PRICES
    },

    parseEvent: (raw, signature) => parseStripeEvent(stripe, raw, signature, config.webhookSecret),
  }
}

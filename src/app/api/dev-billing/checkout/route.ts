import { NextResponse } from 'next/server'
import { readFakeSession, sendFakeWebhook, writeFakeSubscription } from '@/lib/billing/fake-billing'
import type { BillingSubscription } from '@/lib/billing/types'
import { getBillingEnv } from '@/lib/server-env'

const DAY_MS = 86_400_000

// Só CI e desenvolvimento: "paga" a sessão, cria a assinatura falsa, dispara o
// webhook assinado (como faria o Stripe) e volta para o painel.
export async function GET(request: Request) {
  if (getBillingEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })

  const sessionId = new URL(request.url).searchParams.get('sessao') ?? ''
  const session = await readFakeSession(sessionId).catch(() => null)
  if (!session) {
    console.error('[dev-billing] sessão de checkout não encontrada', sessionId)
    return new NextResponse(null, { status: 404 })
  }

  const subscription: BillingSubscription = {
    id: `sub_fake_${crypto.randomUUID()}`,
    customerId: session.customerId,
    userId: session.userId,
    status: 'active',
    interval: session.interval,
    currentPeriodEnd: new Date(Date.now() + (session.interval === 'year' ? 365 : 30) * DAY_MS).toISOString(),
    cancelAtPeriodEnd: false,
  }
  await writeFakeSubscription(subscription)
  await sendFakeWebhook('checkout.session.completed', {
    id: session.id,
    object: 'checkout.session',
    customer: session.customerId,
    subscription: subscription.id,
  })

  return NextResponse.redirect(new URL(session.successUrl, request.url))
}

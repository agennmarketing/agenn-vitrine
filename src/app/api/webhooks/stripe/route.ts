import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { applySubscription, resolveUserId } from '@/features/billing/apply-subscription'
import { getBilling, type Billing } from '@/lib/billing/billing'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Spec 9: só estes eventos mexem na assinatura.
const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

export async function POST(request: Request) {
  const raw = await request.text()

  let billing: Billing
  try {
    billing = getBilling()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Cobrança indisponível.' }, { status: 503 })
  }

  const event = await billing.parseEvent(raw, request.headers.get('stripe-signature'))
  if (!event) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  if (!HANDLED.has(event.type)) return NextResponse.json({ ignored: true })

  try {
    const admin = createSupabaseAdminClient()

    // Idempotência (spec 4.1): evento já processado não volta a mexer em nada.
    const { data: seen, error: seenError } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id)
      .maybeSingle()
    if (seenError) throw seenError
    if (seen) return NextResponse.json({ duplicated: true })

    if (!event.subscriptionId) return NextResponse.json({ ignored: true })

    // Spec 9: o estado sempre vem do Stripe, não do corpo do evento.
    const subscription = await billing.getSubscription(event.subscriptionId)
    if (!subscription) return NextResponse.json({ ignored: true })

    const userId = await resolveUserId(admin, subscription)
    if (!userId) {
      Sentry.captureMessage(`Assinatura sem dono no Stripe: ${subscription.id}`)
      return NextResponse.json({ ignored: true })
    }

    const subdomains = await applySubscription(admin, userId, subscription)

    // Só marca como processado depois de aplicar: uma falha volta na retentativa do Stripe.
    const { error: markError } = await admin
      .from('stripe_events')
      .upsert({ id: event.id, type: event.type }, { ignoreDuplicates: true })
    if (markError) throw markError

    return NextResponse.json({ status: subscription.status, revalidated: subdomains.length })
  } catch (error) {
    Sentry.captureException(error)
    // 500 faz o Stripe tentar de novo.
    return NextResponse.json({ error: 'Falha ao processar o evento.' }, { status: 500 })
  }
}

import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getBilling, type Billing } from '@/lib/billing/billing'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { applySubscription, resolveUserId } from './apply-subscription'

// Spec 9: só estes eventos mexem na assinatura.
const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
])

export type WebhookResult = { status: number; body: Record<string, unknown> }

// Fica fora da rota para que o driver falso possa disparar o mesmo processamento
// sem uma chamada HTTP do servidor para ele mesmo (spec 11: o CI não tem Stripe).
export async function processStripeEvent(raw: string, signature: string | null): Promise<WebhookResult> {
  let billing: Billing
  try {
    billing = getBilling()
  } catch (error) {
    Sentry.captureException(error)
    return { status: 503, body: { error: 'Cobrança indisponível.' } }
  }

  const event = await billing.parseEvent(raw, signature)
  if (!event) return { status: 401, body: { error: 'Assinatura inválida.' } }
  if (!HANDLED.has(event.type)) return { status: 200, body: { ignored: true } }

  try {
    const admin = createSupabaseAdminClient()

    // Idempotência (spec 4.1): evento já processado não volta a mexer em nada.
    const { data: seen, error: seenError } = await admin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id)
      .maybeSingle()
    if (seenError) throw seenError
    if (seen) return { status: 200, body: { duplicated: true } }

    if (!event.subscriptionId) return { status: 200, body: { ignored: true } }

    // Spec 9: o estado sempre vem do Stripe, não do corpo do evento.
    const subscription = await billing.getSubscription(event.subscriptionId)
    if (!subscription) return { status: 200, body: { ignored: true } }

    const userId = await resolveUserId(admin, subscription)
    if (!userId) {
      Sentry.captureMessage(`Assinatura sem dono no Stripe: ${subscription.id}`)
      return { status: 200, body: { ignored: true } }
    }

    const subdomains = await applySubscription(admin, userId, subscription)

    // Só marca como processado depois de aplicar: uma falha volta na retentativa do Stripe.
    const { error: markError } = await admin
      .from('stripe_events')
      .upsert({ id: event.id, type: event.type }, { ignoreDuplicates: true })
    if (markError) throw markError

    return { status: 200, body: { status: subscription.status, revalidated: subdomains.length } }
  } catch (error) {
    Sentry.captureException(error)
    // Também no console: nos testes e nos logs da Vercel o Sentry pode estar desligado.
    console.error('[stripe-webhook] falha ao processar o evento', error)
    // 500 faz o Stripe tentar de novo.
    return { status: 500, body: { error: 'Falha ao processar o evento.' } }
  }
}

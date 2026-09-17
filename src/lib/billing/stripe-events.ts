import 'server-only'
import Stripe from 'stripe'
import type { BillingEvent } from './types'

// O SDK não faz nenhuma chamada até ser usado, então o driver falso também usa este
// cliente — ele só precisa da parte de criptografia do webhook.
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey || 'sk_test_driver_falso')
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

// A união de objetos do Stripe é grande demais para um cast direto; aqui só olhamos
// campos conhecidos, com `idOf` conferindo o formato.
function payloadOf(event: Stripe.Event): Record<string, unknown> {
  return event.data.object as unknown as Record<string, unknown>
}

export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const object = payloadOf(event)
  if (event.type.startsWith('customer.subscription.')) return idOf(object.id)
  if (event.type === 'checkout.session.completed') return idOf(object.subscription)
  // Faturas: de 2025-03-31.basil em diante o id vive em parent.subscription_details;
  // antes disso ficava em invoice.subscription. Aceitar as duas formas deixa a rota
  // imune à versão de API escolhida no endpoint de webhook.
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | null | undefined
  return idOf(parent?.subscription_details?.subscription) ?? idOf(object.subscription)
}

export function customerIdFromEvent(event: Stripe.Event): string | null {
  return idOf(payloadOf(event).customer)
}

export async function parseStripeEvent(
  stripe: Stripe,
  raw: string,
  signature: string | null,
  secret: string,
): Promise<BillingEvent | null> {
  if (!signature) return null
  try {
    const event = await stripe.webhooks.constructEventAsync(raw, signature, secret)
    return {
      id: event.id,
      type: event.type,
      subscriptionId: subscriptionIdFromEvent(event),
      customerId: customerIdFromEvent(event),
    }
  } catch {
    // Assinatura inválida, corpo alterado ou fora da tolerância: a rota responde 401.
    return null
  }
}

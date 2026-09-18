import { NextResponse } from 'next/server'
import { processStripeEvent } from '@/features/billing/process-event'

// Spec 9: a verificação da assinatura e o processamento ficam em process-event.ts,
// compartilhados com o disparador de eventos do driver falso.
export async function POST(request: Request) {
  const raw = await request.text()
  const { status, body } = await processStripeEvent(raw, request.headers.get('stripe-signature'))
  return NextResponse.json(body, { status })
}

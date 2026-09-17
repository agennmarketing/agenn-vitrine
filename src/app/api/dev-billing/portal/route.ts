import { NextResponse } from 'next/server'
import { findFakeSubscriptionByCustomer, sendFakeWebhook, writeFakeSubscription } from '@/lib/billing/fake-billing'
import { escapeHtml } from '@/lib/email/html'
import { getBillingEnv } from '@/lib/server-env'

// Só CI e desenvolvimento: faz o papel do Customer Portal, com as duas saídas que
// interessam aos testes — cancelar no fim do período e cancelar agora.
export async function GET(request: Request) {
  if (getBillingEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })

  const url = new URL(request.url)
  const customerId = url.searchParams.get('cliente') ?? ''
  const back = url.searchParams.get('retorno') ?? '/painel/plano'
  const action = url.searchParams.get('acao')

  const subscription = await findFakeSubscriptionByCustomer(customerId)
  if (!subscription) return new NextResponse(null, { status: 404 })

  if (action === 'agendar' || action === 'cancelar') {
    const updated =
      action === 'agendar'
        ? { ...subscription, cancelAtPeriodEnd: true }
        : { ...subscription, status: 'canceled' as const, cancelAtPeriodEnd: false }
    await writeFakeSubscription(updated)
    await sendFakeWebhook(
      request,
      action === 'agendar' ? 'customer.subscription.updated' : 'customer.subscription.deleted',
      { id: updated.id, object: 'subscription', customer: customerId },
    )
    return NextResponse.redirect(new URL(back, request.url))
  }

  const base = `${url.pathname}?cliente=${encodeURIComponent(customerId)}&retorno=${encodeURIComponent(back)}`
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Portal de teste</title></head>
<body>
<h1>Portal de teste</h1>
<p>Assinatura ${escapeHtml(subscription.id)} — ${escapeHtml(subscription.status)}.</p>
<p><a href="${escapeHtml(base)}&acao=agendar">Cancelar no fim do período</a></p>
<p><a href="${escapeHtml(base)}&acao=cancelar">Cancelar agora</a></p>
<p><a href="${escapeHtml(back)}">Voltar ao painel</a></p>
</body></html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

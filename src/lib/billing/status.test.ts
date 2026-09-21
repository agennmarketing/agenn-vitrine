import { describe, expect, it } from 'vitest'
import { describeSubscription, isProNow, subscriptionRowFrom } from './status'
import type { BillingStatus, BillingSubscription } from './types'

const NOW = new Date('2026-09-17T12:00:00.000Z')

function subscription(status: BillingStatus, overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    id: 'sub_1',
    customerId: 'cus_1',
    userId: 'user-1',
    status,
    interval: 'month',
    currentPeriodEnd: '2026-10-17T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...overrides,
  }
}

describe('subscriptionRowFrom', () => {
  it('assinatura ativa vira Pro sem carência', () => {
    expect(subscriptionRowFrom(subscription('active'), null, NOW)).toEqual({
      plan_id: 'pro',
      status: 'active',
      interval: 'month',
      current_period_end: '2026-10-17T12:00:00.000Z',
      cancel_at_period_end: false,
      grace_until: null,
      pro_ended_at: null,
    })
  })

  it('período de teste também é Pro', () => {
    expect(subscriptionRowFrom(subscription('trialing'), null, NOW).grace_until).toBeNull()
  })

  it('primeira falha dá 7 dias de carência', () => {
    const row = subscriptionRowFrom(subscription('past_due'), null, NOW)
    expect(row.grace_until).toBe('2026-09-24T12:00:00.000Z')
    expect(row.pro_ended_at).toBeNull()
  })

  it('falhas seguintes mantêm a carência da primeira', () => {
    const previous = { status: 'past_due', grace_until: '2026-09-20T00:00:00.000Z', pro_ended_at: null }
    expect(subscriptionRowFrom(subscription('past_due'), previous, NOW).grace_until).toBe('2026-09-20T00:00:00.000Z')
  })

  it('cancelada, não paga e expirada voltam ao gratuito e marcam o fim do Pro', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired'] as const) {
      const row = subscriptionRowFrom(subscription(status), null, NOW)
      expect([row.grace_until, row.pro_ended_at]).toEqual([null, NOW.toISOString()])
    }
  })

  it('não muda o fim do Pro já registrado', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('canceled'), previous, NOW).pro_ended_at).toBe('2026-06-01T00:00:00.000Z')
  })

  it('voltar ao Pro limpa carência e fim do Pro', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('active'), previous, NOW).pro_ended_at).toBeNull()
  })

  it('incompleta não é Pro nem encerra nada', () => {
    const row = subscriptionRowFrom(subscription('incomplete'), null, NOW)
    expect([row.grace_until, row.pro_ended_at]).toEqual([null, null])
  })

  it('guarda o cancelamento agendado e o intervalo', () => {
    const row = subscriptionRowFrom(subscription('active', { cancelAtPeriodEnd: true, interval: 'year' }), null, NOW)
    expect([row.cancel_at_period_end, row.interval]).toEqual([true, 'year'])
  })
})

describe('isProNow', () => {
  it('vale para ativa, teste e carência em dia', () => {
    expect(isProNow({ status: 'active', grace_until: null }, NOW)).toBe(true)
    expect(isProNow({ status: 'trialing', grace_until: null }, NOW)).toBe(true)
    expect(isProNow({ status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' }, NOW)).toBe(true)
  })

  it('não vale sem assinatura nem depois da carência', () => {
    expect(isProNow(null, NOW)).toBe(false)
    expect(isProNow({ status: 'past_due', grace_until: '2026-09-10T12:00:00.000Z' }, NOW)).toBe(false)
    expect(isProNow({ status: 'canceled', grace_until: null }, NOW)).toBe(false)
  })
})

describe('describeSubscription', () => {
  const base = {
    stripe_customer_id: 'cus_1',
    interval: 'month' as const,
    current_period_end: '2026-10-17T12:00:00.000Z',
    cancel_at_period_end: false,
    grace_until: null,
    pro_ended_at: null,
  }

  it('sem assinatura convida para o Pro', () => {
    const summary = describeSubscription(null, NOW)
    expect([summary.pro, summary.title, summary.showSubscribe, summary.showPortal]).toEqual([
      false,
      'Plano Gratuito',
      true,
      false,
    ])
  })

  it('checkout começado e não concluído não mostra o portal', () => {
    const summary = describeSubscription({ ...base, status: 'none', interval: null, current_period_end: null }, NOW)
    expect([summary.pro, summary.showSubscribe, summary.showPortal]).toEqual([false, true, false])
  })

  it('assinatura ativa mostra a renovação', () => {
    const summary = describeSubscription({ ...base, status: 'active' }, NOW)
    expect(summary.pro).toBe(true)
    expect(summary.detail).toBe('Renova em 17/10/2026.')
    expect([summary.showSubscribe, summary.showPortal]).toEqual([false, true])
  })

  it('cancelamento agendado mostra até quando vale', () => {
    const summary = describeSubscription({ ...base, status: 'active', cancel_at_period_end: true }, NOW)
    expect(summary.detail).toBe('Cancelamento agendado: o Pro vale até 17/10/2026.')
  })

  it('pagamento pendente pede atualização até o fim da carência', () => {
    const summary = describeSubscription(
      { ...base, status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' },
      NOW,
    )
    expect(summary.pro).toBe(true)
    expect(summary.detail).toBe(
      'Não conseguimos cobrar seu cartão. Atualize o pagamento até 24/09/2026 para não perder o Pro.',
    )
  })

  it('Pro encerrado lembra a regra dos 90 dias e mantém o portal', () => {
    const summary = describeSubscription(
      { ...base, status: 'canceled', current_period_end: null, pro_ended_at: '2026-08-01T12:00:00.000Z' },
      NOW,
    )
    expect([summary.pro, summary.showSubscribe, summary.showPortal]).toEqual([false, true, true])
    expect(summary.detail).toBe(
      'Seu Pro terminou em 01/08/2026. Os vídeos que passam do limite do gratuito são apagados 90 dias depois.',
    )
  })
})

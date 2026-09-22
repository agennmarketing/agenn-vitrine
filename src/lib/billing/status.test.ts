import { describe, expect, it } from 'vitest'
import { accessFor, describeSubscription, isPaidNow, subscriptionRowFrom, trialNotice } from './status'
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
  it('assinatura paga vira ativa, sem carência', () => {
    expect(subscriptionRowFrom(subscription('active'), null, NOW)).toEqual({
      plan_id: 'essencial',
      status: 'active',
      interval: 'month',
      current_period_end: '2026-10-17T12:00:00.000Z',
      cancel_at_period_end: false,
      grace_until: null,
      pro_ended_at: null,
      subscription_status: 'active',
    })
  })

  it('teste do Stripe também conta como pago', () => {
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

  it('cancelada, não paga e expirada viram canceladas e marcam o fim', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired'] as const) {
      const row = subscriptionRowFrom(subscription(status), null, NOW)
      expect([row.grace_until, row.pro_ended_at, row.subscription_status]).toEqual([null, NOW.toISOString(), 'canceled'])
    }
  })

  it('não muda o fim já registrado', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('canceled'), previous, NOW).pro_ended_at).toBe('2026-06-01T00:00:00.000Z')
  })

  it('assinar de novo limpa carência e fim', () => {
    const previous = { status: 'canceled', grace_until: null, pro_ended_at: '2026-06-01T00:00:00.000Z' }
    expect(subscriptionRowFrom(subscription('active'), previous, NOW).pro_ended_at).toBeNull()
  })

  it('incompleta não paga, não encerra nada nem muda a situação da conta', () => {
    const row = subscriptionRowFrom(subscription('incomplete'), null, NOW)
    expect([row.grace_until, row.pro_ended_at, row.subscription_status]).toEqual([null, null, undefined])
  })

  it('guarda o cancelamento agendado e o intervalo', () => {
    const row = subscriptionRowFrom(subscription('active', { cancelAtPeriodEnd: true, interval: 'year' }), null, NOW)
    expect([row.cancel_at_period_end, row.interval]).toEqual([true, 'year'])
  })
})

describe('isPaidNow', () => {
  it('vale para ativa, teste do Stripe e carência em dia', () => {
    expect(isPaidNow({ status: 'active', grace_until: null }, NOW)).toBe(true)
    expect(isPaidNow({ status: 'trialing', grace_until: null }, NOW)).toBe(true)
    expect(isPaidNow({ status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' }, NOW)).toBe(true)
  })

  it('não vale sem assinatura nem depois da carência', () => {
    expect(isPaidNow(null, NOW)).toBe(false)
    expect(isPaidNow({ status: 'none', grace_until: null }, NOW)).toBe(false)
    expect(isPaidNow({ status: 'past_due', grace_until: '2026-09-10T12:00:00.000Z' }, NOW)).toBe(false)
    expect(isPaidNow({ status: 'canceled', grace_until: null }, NOW)).toBe(false)
  })
})

// NOW = 17/09/2026 09:00 em Brasília.
const trial = (endsAt: string, subscription_status = 'trialing') => ({
  status: 'none',
  grace_until: null,
  trial_ends_at: endsAt,
  subscription_status,
})

describe('accessFor', () => {
  it('teste valendo libera tudo e conta os dias de calendário', () => {
    expect(accessFor(trial('2026-09-24T12:00:00.000Z'), NOW)).toEqual({
      status: 'trialing',
      hasAccess: true,
      trialEndsAt: '2026-09-24T12:00:00.000Z',
      trialDaysLeft: 7,
    })
  })

  it('assinatura paga vale mesmo com o teste vencido', () => {
    const access = accessFor({ ...trial('2026-09-01T12:00:00.000Z'), status: 'active', subscription_status: 'active' }, NOW)
    expect([access.status, access.hasAccess]).toEqual(['active', true])
  })

  it('teste vencido sem assinatura bloqueia', () => {
    expect(accessFor(trial('2026-09-17T11:59:00.000Z'), NOW)).toEqual({
      status: 'expired',
      hasAccess: false,
      trialEndsAt: '2026-09-17T11:59:00.000Z',
      trialDaysLeft: null,
    })
  })

  it('assinatura cancelada depois do teste bloqueia como cancelada', () => {
    const access = accessFor({ ...trial('2026-09-01T12:00:00.000Z', 'canceled'), status: 'canceled' }, NOW)
    expect([access.status, access.hasAccess]).toEqual(['canceled', false])
  })

  it('sem linha de assinatura, sem acesso', () => {
    expect(accessFor(null, NOW).hasAccess).toBe(false)
  })
})

describe('trialNotice', () => {
  const notice = (endsAt: string) => trialNotice(accessFor(trial(endsAt), NOW))

  it('só aparece nos 3 últimos dias', () => {
    expect(notice('2026-09-21T12:00:00.000Z')).toBeNull()
    expect(notice('2026-09-20T12:00:00.000Z')).toBe('Seu teste grátis termina em 3 dias. Assine para continuar usando o Agenn.')
    expect(notice('2026-09-19T12:00:00.000Z')).toBe('Seu teste grátis termina em 2 dias. Assine para continuar usando o Agenn.')
  })

  it('faltando 1 dia e no último dia', () => {
    expect(notice('2026-09-18T12:00:00.000Z')).toBe('Seu teste grátis termina amanhã. Assine para continuar usando o Agenn.')
    // 23:30 de Brasília ainda é hoje, embora já seja o dia 18 em UTC.
    expect(notice('2026-09-18T02:30:00.000Z')).toBe('Seu teste grátis termina hoje. Assine para continuar usando o Agenn.')
  })

  it('não aparece para quem assinou', () => {
    expect(trialNotice(accessFor({ ...trial('2026-09-18T12:00:00.000Z'), status: 'active' }, NOW))).toBeNull()
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
    trial_started_at: '2026-09-01T12:00:00.000Z',
    trial_ends_at: '2026-09-08T12:00:00.000Z',
    subscription_status: 'active',
  }
  const unpaid = { stripe_customer_id: null, status: 'none', interval: null, current_period_end: null }

  it('no teste mostra até quando vai e convida a assinar', () => {
    const summary = describeSubscription(
      { ...base, ...unpaid, trial_ends_at: '2026-09-24T12:00:00.000Z', subscription_status: 'trialing' },
      NOW,
    )
    expect([summary.title, summary.showSubscribe, summary.showPortal]).toEqual(['Teste grátis — 7 dias restantes', true, false])
    expect(summary.detail).toBe('Vai até 24/09/2026. Assine para continuar usando o Agenn depois disso.')
  })

  it('teste encerrado lembra que os dados continuam guardados', () => {
    const summary = describeSubscription({ ...base, ...unpaid, subscription_status: 'expired' }, NOW)
    expect([summary.access.status, summary.title, summary.showSubscribe]).toEqual(['expired', 'Seu teste terminou', true])
    expect(summary.detail).toBe('Seus dados continuam guardados: assine para voltar a usar o Agenn.')
  })

  it('checkout começado e não concluído não mostra o portal', () => {
    const summary = describeSubscription({ ...base, ...unpaid, stripe_customer_id: 'cus_1', subscription_status: 'expired' }, NOW)
    expect([summary.access.hasAccess, summary.showSubscribe, summary.showPortal]).toEqual([false, true, false])
  })

  it('assinatura ativa mostra a próxima cobrança', () => {
    const summary = describeSubscription({ ...base, status: 'active' }, NOW)
    expect([summary.title, summary.detail]).toEqual(['Plano Essencial — Ativo', 'Próxima cobrança em 17/10/2026.'])
    expect([summary.showSubscribe, summary.showPortal]).toEqual([false, true])
  })

  it('cancelamento agendado mostra até quando vale', () => {
    const summary = describeSubscription({ ...base, status: 'active', cancel_at_period_end: true }, NOW)
    expect(summary.detail).toBe('Cancelamento agendado: a assinatura vale até 17/10/2026.')
  })

  it('pagamento pendente pede atualização até o fim da carência', () => {
    const summary = describeSubscription({ ...base, status: 'past_due', grace_until: '2026-09-24T12:00:00.000Z' }, NOW)
    expect(summary.access.hasAccess).toBe(true)
    expect(summary.detail).toBe(
      'Não conseguimos cobrar seu cartão. Atualize o pagamento até 24/09/2026 para continuar usando o Agenn.',
    )
  })

  it('assinatura cancelada mantém o portal e convida a assinar de novo', () => {
    const summary = describeSubscription(
      { ...base, status: 'canceled', current_period_end: null, pro_ended_at: '2026-09-10T12:00:00.000Z', subscription_status: 'canceled' },
      NOW,
    )
    expect([summary.access.status, summary.showSubscribe, summary.showPortal]).toEqual(['canceled', true, true])
    expect([summary.title, summary.detail]).toEqual([
      'Sua assinatura terminou',
      'Seus dados continuam guardados: assine para voltar a usar o Agenn.',
    ])
  })
})

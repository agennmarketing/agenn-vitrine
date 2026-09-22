import { formatDateBR } from '@/lib/dates/format'
import type { BillingInterval, BillingStatus, BillingSubscription } from './types'

// Spec 9: o Stripe tenta cobrar por 7 dias antes de cancelar.
export const GRACE_DAYS = 7
export const TRIAL_DAYS = 7
export const PLAN_NAME = 'Plano Essencial'
/** Referência para textos; o valor cobrado vem do preço do Stripe. */
export const PLAN_PRICE_CENTS = 7990
const DAY_MS = 86_400_000

export const NO_ACCESS_MESSAGE = 'Seu acesso está pausado. Assine o Plano Essencial para continuar usando o Agenn.'

/** Situação da conta guardada em `subscriptions.subscription_status`. */
export type AccountStatus = 'trialing' | 'active' | 'expired' | 'canceled'

export type SubscriptionRow = {
  plan_id: 'essencial'
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
  subscription_status?: AccountStatus
}

export type PreviousRow = { status: string; grace_until: string | null; pro_ended_at: string | null } | null

const PAID: readonly BillingStatus[] = ['active', 'trialing']
const ENDED: readonly BillingStatus[] = ['canceled', 'unpaid', 'incomplete_expired']

export function subscriptionRowFrom(
  subscription: BillingSubscription,
  previous: PreviousRow,
  now: Date,
): SubscriptionRow {
  const base = {
    plan_id: 'essencial' as const,
    status: subscription.status,
    interval: subscription.interval,
    current_period_end: subscription.currentPeriodEnd,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
  }

  if (PAID.includes(subscription.status)) {
    return { ...base, grace_until: null, pro_ended_at: null, subscription_status: 'active' }
  }
  if (subscription.status === 'past_due') {
    // A carência é da primeira falha: só cria se ainda não existir.
    const kept = previous?.status === 'past_due' ? previous.grace_until : null
    return {
      ...base,
      grace_until: kept ?? new Date(now.getTime() + GRACE_DAYS * DAY_MS).toISOString(),
      pro_ended_at: null,
      subscription_status: 'active',
    }
  }
  if (ENDED.includes(subscription.status)) {
    return {
      ...base,
      grace_until: null,
      pro_ended_at: previous?.pro_ended_at ?? now.toISOString(),
      subscription_status: 'canceled',
    }
  }
  // incomplete e paused: ainda não pagou; a situação da conta (teste ou expirado) não muda.
  return { ...base, grace_until: null, pro_ended_at: previous?.pro_ended_at ?? null }
}

/** Assinatura paga valendo agora (inclui a carência de cobrança). */
export function isPaidNow(row: { status: string; grace_until: string | null } | null, now: Date): boolean {
  if (!row) return false
  if (row.status === 'active' || row.status === 'trialing') return true
  return row.status === 'past_due' && row.grace_until !== null && new Date(row.grace_until) > now
}

export type AccessRow = {
  status: string
  grace_until: string | null
  trial_ends_at: string | null
  subscription_status: string
}

export type Access = {
  status: AccountStatus
  /** Tudo liberado (teste valendo ou assinatura em dia). */
  hasAccess: boolean
  trialEndsAt: string | null
  /** Dias de calendário (horário de Brasília) até o fim do teste; 0 = termina hoje. */
  trialDaysLeft: number | null
}

const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })

function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.parse(DAY_KEY.format(from))
  const end = Date.parse(DAY_KEY.format(to))
  return Math.round((end - start) / DAY_MS)
}

// Espelho de `effective_plan_id` no banco: quem decide de verdade é o banco.
export function accessFor(row: AccessRow | null, now: Date): Access {
  if (!row) return { status: 'expired', hasAccess: false, trialEndsAt: null, trialDaysLeft: null }

  if (isPaidNow(row, now)) {
    return { status: 'active', hasAccess: true, trialEndsAt: row.trial_ends_at, trialDaysLeft: null }
  }
  if (row.trial_ends_at && new Date(row.trial_ends_at) > now) {
    return {
      status: 'trialing',
      hasAccess: true,
      trialEndsAt: row.trial_ends_at,
      trialDaysLeft: Math.max(0, calendarDaysBetween(now, new Date(row.trial_ends_at))),
    }
  }
  return {
    status: row.subscription_status === 'canceled' ? 'canceled' : 'expired',
    hasAccess: false,
    trialEndsAt: row.trial_ends_at,
    trialDaysLeft: null,
  }
}

/** Aviso do painel nos 3 últimos dias do teste (com 3, 2, 1 e 0 dias). */
export function trialNotice(access: Access): string | null {
  const days = access.trialDaysLeft
  if (access.status !== 'trialing' || days === null || days > 3) return null
  const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`
  return `Seu teste grátis termina ${when}. Assine para continuar usando o Agenn.`
}

export type SubscriptionView = {
  stripe_customer_id: string | null
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  subscription_status: string
}

export type SubscriptionSummary = {
  access: Access
  title: string
  detail: string
  showSubscribe: boolean
  showPortal: boolean
}

export function describeSubscription(row: SubscriptionView | null, now: Date): SubscriptionSummary {
  const access = accessFor(row, now)
  const paid = isPaidNow(row, now)
  // O portal só aparece para quem já assinou: começar o checkout e desistir não conta.
  const showPortal = Boolean(row?.stripe_customer_id) && (paid || Boolean(row?.pro_ended_at))

  if (!paid) {
    if (access.status === 'trialing') {
      const days = access.trialDaysLeft ?? 0
      const left = days === 0 ? 'termina hoje' : days === 1 ? '1 dia restante' : `${days} dias restantes`
      return {
        access,
        title: `Teste grátis — ${left}`,
        detail: `Vai até ${formatDateBR(access.trialEndsAt)}. Assine para continuar usando o Agenn depois disso.`,
        showSubscribe: true,
        showPortal,
      }
    }
    const title = access.status === 'canceled' ? 'Sua assinatura terminou' : 'Seu teste terminou'
    const detail = 'Seus dados continuam guardados: assine para voltar a usar o Agenn.'
    return { access, title, detail, showSubscribe: true, showPortal }
  }

  let detail: string
  if (row!.status === 'past_due') {
    detail = `Não conseguimos cobrar seu cartão. Atualize o pagamento até ${formatDateBR(row!.grace_until)} para continuar usando o Agenn.`
  } else if (row!.cancel_at_period_end) {
    detail = `Cancelamento agendado: a assinatura vale até ${formatDateBR(row!.current_period_end)}.`
  } else {
    detail = row!.current_period_end ? `Próxima cobrança em ${formatDateBR(row!.current_period_end)}.` : 'Assinatura em dia.'
  }

  return { access, title: `${PLAN_NAME} — Ativo`, detail, showSubscribe: false, showPortal: true }
}

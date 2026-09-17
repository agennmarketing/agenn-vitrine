import { formatDateBR } from '@/lib/dates/format'
import type { BillingInterval, BillingStatus, BillingSubscription } from './types'

// Spec 9: o Stripe tenta cobrar por 7 dias antes de cancelar.
export const GRACE_DAYS = 7
const DAY_MS = 86_400_000

export type SubscriptionRow = {
  plan_id: 'pro'
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
}

export type PreviousRow = { status: string; grace_until: string | null; pro_ended_at: string | null } | null

const PRO: readonly BillingStatus[] = ['active', 'trialing']
const ENDED: readonly BillingStatus[] = ['canceled', 'unpaid', 'incomplete_expired']

export function subscriptionRowFrom(
  subscription: BillingSubscription,
  previous: PreviousRow,
  now: Date,
): SubscriptionRow {
  const base = {
    plan_id: 'pro' as const,
    status: subscription.status,
    interval: subscription.interval,
    current_period_end: subscription.currentPeriodEnd,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
  }

  if (PRO.includes(subscription.status)) {
    return { ...base, grace_until: null, pro_ended_at: null }
  }
  if (subscription.status === 'past_due') {
    // A carência é da primeira falha: só cria se ainda não existir.
    const kept = previous?.status === 'past_due' ? previous.grace_until : null
    return {
      ...base,
      grace_until: kept ?? new Date(now.getTime() + GRACE_DAYS * DAY_MS).toISOString(),
      pro_ended_at: null,
    }
  }
  if (ENDED.includes(subscription.status)) {
    return { ...base, grace_until: null, pro_ended_at: previous?.pro_ended_at ?? now.toISOString() }
  }
  // incomplete e paused: ainda não virou Pro, nada a encerrar.
  return { ...base, grace_until: null, pro_ended_at: previous?.pro_ended_at ?? null }
}

export function isProNow(row: { status: string; grace_until: string | null } | null, now: Date): boolean {
  if (!row) return false
  if (row.status === 'active' || row.status === 'trialing') return true
  return row.status === 'past_due' && row.grace_until !== null && new Date(row.grace_until) > now
}

export type SubscriptionView = {
  stripe_customer_id: string | null
  status: string
  interval: BillingInterval | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  grace_until: string | null
  pro_ended_at: string | null
}

export type SubscriptionSummary = {
  pro: boolean
  title: string
  detail: string
  showSubscribe: boolean
  showPortal: boolean
}

const FREE_PITCH =
  'Assine o Pro para ter 3 vitrines, 300 itens por vitrine, 50 vídeos por vitrine, logo, cor da marca e banner — e tirar a marca d’água.'

export function describeSubscription(row: SubscriptionView | null, now: Date): SubscriptionSummary {
  const pro = isProNow(row, now)
  const showPortal = Boolean(row?.stripe_customer_id)

  if (!row || !pro) {
    const detail = row?.pro_ended_at
      ? `Seu Pro terminou em ${formatDateBR(row.pro_ended_at)}. Os vídeos que passam do limite do gratuito são apagados 90 dias depois.`
      : FREE_PITCH
    return { pro: false, title: 'Plano Gratuito', detail, showSubscribe: true, showPortal }
  }

  let detail: string
  if (row.status === 'past_due') {
    detail = `Não conseguimos cobrar seu cartão. Atualize o pagamento até ${formatDateBR(row.grace_until)} para não perder o Pro.`
  } else if (row.cancel_at_period_end) {
    detail = `Cancelamento agendado: o Pro vale até ${formatDateBR(row.current_period_end)}.`
  } else if (row.status === 'trialing') {
    detail = `Período de teste até ${formatDateBR(row.current_period_end)}.`
  } else {
    detail = row.current_period_end ? `Renova em ${formatDateBR(row.current_period_end)}.` : 'Assinatura ativa.'
  }

  return { pro: true, title: 'Plano Pro', detail, showSubscribe: false, showPortal: true }
}

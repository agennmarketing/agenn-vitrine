import { formatBRL } from '@/lib/money/money'
import { PLAN_PRICE_CENTS } from './status'
import type { BillingPrice } from './types'

/** Preço do Plano Essencial por extenso ("R$ 79,90 por mês"). Sem o Stripe, vale o de referência. */
export function monthlyPriceLabel(prices: BillingPrice[]): string {
  const month = prices.find((price) => price.interval === 'month')
  return `${formatBRL(month?.amountCents ?? PLAN_PRICE_CENTS)} por mês`
}

/** O mesmo preço em forma curta, para o cartão do plano ("R$ 79,90/mês"). */
export function monthlyPriceShort(prices: BillingPrice[]): string {
  const month = prices.find((price) => price.interval === 'month')
  return `${formatBRL(month?.amountCents ?? PLAN_PRICE_CENTS)}/mês`
}

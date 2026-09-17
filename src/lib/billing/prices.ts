import { formatBRL } from '@/lib/money/money'
import type { BillingInterval, BillingPrice } from './types'

export type PriceCard = {
  interval: BillingInterval
  priceId: string
  amountCents: number
  title: string
  note: string
}

export function priceCards(prices: BillingPrice[]): PriceCard[] {
  const month = prices.find((price) => price.interval === 'month')
  const year = prices.find((price) => price.interval === 'year')
  const cards: PriceCard[] = []

  if (month) {
    cards.push({
      interval: 'month',
      priceId: month.id,
      amountCents: month.amountCents,
      title: `${formatBRL(month.amountCents)} por mês`,
      note: 'Cobrança mensal no cartão. Cancele quando quiser.',
    })
  }
  if (year) {
    const fullYear = month ? month.amountCents * 12 : 0
    const savings = fullYear > year.amountCents ? Math.round(((fullYear - year.amountCents) / fullYear) * 100) : 0
    cards.push({
      interval: 'year',
      priceId: year.id,
      amountCents: year.amountCents,
      title: `${formatBRL(year.amountCents)} por ano`,
      note: savings > 0 ? `Economize ${savings}% em relação ao mensal.` : 'Cobrança anual no cartão.',
    })
  }
  return cards
}

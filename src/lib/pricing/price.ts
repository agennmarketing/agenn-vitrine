import { formatBRL } from '@/lib/money/money'

export type PriceType = 'fixed' | 'from' | 'on_request'
export type PricedItem = { priceType: PriceType; priceCents: number | null; promoPriceCents: number | null }
export type PricedVariation = { priceCents: number; promoPriceCents: number | null }

// Regra 4.6.1: variação substitui o item; promoção vale quando existe.
export function unitPriceCents(item: PricedItem, variation?: PricedVariation | null): number | null {
  if (item.priceType === 'on_request') return null
  const source = variation ?? item
  if (source.priceCents == null) return null
  return source.promoPriceCents ?? source.priceCents
}

// Regra 4.6.4.
export function lineTotalCents(unitCents: number | null, qty: number): number | null {
  if (unitCents == null) return null
  return unitCents * qty
}

// Regra 4.6.5: itens sob consulta ficam fora da soma.
export function orderTotal(lineTotals: ReadonlyArray<number | null>) {
  let totalCents = 0
  let hasOnRequest = false
  for (const line of lineTotals) {
    if (line == null) hasOnRequest = true
    else totalCents += line
  }
  return { totalCents, hasOnRequest }
}

export function formatOrderTotal(total: { totalCents: number; hasOnRequest: boolean }): string {
  if (total.totalCents === 0 && total.hasOnRequest) return 'Itens sob consulta'
  const value = formatBRL(total.totalCents)
  return total.hasOnRequest ? `${value} + itens sob consulta` : value
}

export type PriceLabel =
  | { kind: 'on_request' }
  | { kind: 'price'; fromPrefix: boolean; cents: number; originalCents: number | null }

export function priceLabel(item: PricedItem, variations: ReadonlyArray<PricedVariation> = []): PriceLabel {
  if (item.priceType === 'on_request') return { kind: 'on_request' }

  if (variations.length > 0) {
    const effective = variations.map((variation) => variation.promoPriceCents ?? variation.priceCents)
    const min = Math.min(...effective)
    const allEqual = effective.every((cents) => cents === min)
    return { kind: 'price', fromPrefix: !allEqual || item.priceType === 'from', cents: min, originalCents: null }
  }

  if (item.priceCents == null) return { kind: 'on_request' }
  return {
    kind: 'price',
    fromPrefix: item.priceType === 'from',
    cents: item.promoPriceCents ?? item.priceCents,
    originalCents: item.promoPriceCents != null ? item.priceCents : null,
  }
}

export function formatPriceLabel(label: PriceLabel): string {
  if (label.kind === 'on_request') return 'Sob consulta'
  const value = formatBRL(label.cents)
  return label.fromPrefix ? `A partir de ${value}` : value
}

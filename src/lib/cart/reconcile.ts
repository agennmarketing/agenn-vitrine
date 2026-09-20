import { lineTotalCents, orderTotal, unitPriceCents, type PricedItem, type PricedVariation } from '@/lib/pricing/price'
import type { CartLine, NewCartLine } from './cart'

export type CartCatalogItem = PricedItem & {
  id: string
  code: string
  name: string
  soldOut: boolean
  variations: (PricedVariation & { id: string; name: string; soldOut: boolean })[]
}

function isAvailable(line: NewCartLine, item: CartCatalogItem): boolean {
  if (item.soldOut) return false
  if (item.variations.length > 0) {
    const variation = item.variations.find((v) => v.id === line.variationId)
    if (!variation || variation.soldOut) return false
  } else if (line.variationId) {
    return false
  }
  return true
}

// Spec 7.4: ao abrir, confere com os dados atuais e remove o que não dá mais para pedir.
export function reconcileCart(lines: CartLine[], items: ReadonlyMap<string, CartCatalogItem>) {
  const kept: CartLine[] = []
  const removedNames: string[] = []
  for (const line of lines) {
    const item = items.get(line.itemId)
    if (item && isAvailable(line, item)) {
      kept.push(line)
      continue
    }
    const name = item?.name ?? 'Um item'
    if (!removedNames.includes(name)) removedNames.push(name)
  }
  return { lines: kept, removedNames }
}

export function lineUnitCents(line: NewCartLine, item: CartCatalogItem): number | null {
  const variation = line.variationId ? (item.variations.find((v) => v.id === line.variationId) ?? null) : null
  return unitPriceCents(item, variation)
}

export function cartSummary(lines: CartLine[], items: ReadonlyMap<string, CartCatalogItem>) {
  const known = lines.filter((line) => items.has(line.itemId))
  return {
    count: known.reduce((sum, line) => sum + line.qty, 0),
    total: orderTotal(known.map((line) => lineTotalCents(lineUnitCents(line, items.get(line.itemId)!), line.qty))),
  }
}

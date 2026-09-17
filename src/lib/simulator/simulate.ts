import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents, orderTotal, unitPriceCents, type PriceType } from '@/lib/pricing/price'

export type SimulatorItem = {
  id: string; code: string; name: string; vitrineName: string; deleted: boolean; soldOut: boolean
  priceType: PriceType; priceCents: number | null; promoPriceCents: number | null
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null }[]
}

export type SimulatorLineInput = {
  itemId: string
  variationId: string | null
  qty: number
  previousUnitCents?: number | null
  snapshotName?: string
  snapshotCode?: string
  snapshotVariationName?: string | null
}

export type SimulatedLine = {
  name: string
  code: string
  variationName: string | null
  qty: number
  unitCents: number | null
  subtotalCents: number | null
  status: 'ok' | 'price_changed' | 'removed' | 'variation_removed'
  previousUnitCents: number | null
}

export function simulateOrder(lines: readonly SimulatorLineInput[], items: ReadonlyMap<string, SimulatorItem>) {
  const simulated: SimulatedLine[] = lines.map((line) => {
    const item = items.get(line.itemId)
    const previousUnitCents = line.previousUnitCents ?? null
    if (!item || item.deleted) {
      return {
        name: item?.name ?? line.snapshotName ?? 'Item',
        code: item?.code ?? line.snapshotCode ?? '',
        variationName: line.snapshotVariationName ?? null,
        qty: line.qty,
        unitCents: null,
        subtotalCents: null,
        status: 'removed',
        previousUnitCents,
      }
    }
    const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
    if (line.variationId && !variation) {
      return {
        name: item.name, code: item.code, variationName: line.snapshotVariationName ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'variation_removed', previousUnitCents,
      }
    }
    const unitCents = unitPriceCents(item, variation ?? null)
    const changed = line.previousUnitCents !== undefined && previousUnitCents !== unitCents
    return {
      name: item.name,
      code: item.code,
      variationName: variation?.name ?? null,
      qty: line.qty,
      unitCents,
      subtotalCents: lineTotalCents(unitCents, line.qty),
      status: changed ? 'price_changed' : 'ok',
      previousUnitCents,
    }
  })

  const counted = simulated.filter((line) => line.status === 'ok' || line.status === 'price_changed')
  return {
    lines: simulated,
    total: orderTotal(counted.map((line) => line.subtotalCents)),
    hasChanges: simulated.some((line) => line.status !== 'ok'),
  }
}

export function linesFromSnapshot(payload: unknown): SimulatorLineInput[] {
  const items = (payload as { items?: unknown })?.items
  if (!Array.isArray(items)) return []
  return items.map((raw) => {
    const line = raw as {
      item_id: string; code: string; name: string; qty: number
      variation: { id: string; name: string } | null; unit_price_cents: number | null
    }
    return {
      itemId: line.item_id,
      variationId: line.variation?.id ?? null,
      qty: line.qty,
      previousUnitCents: line.unit_price_cents,
      snapshotName: line.name,
      snapshotCode: line.code,
      snapshotVariationName: line.variation?.name ?? null,
    }
  })
}

export function buildPricedSummary(result: ReturnType<typeof simulateOrder>, orderCode: string | null): string {
  const lines = result.lines
    .filter((line) => line.status === 'ok' || line.status === 'price_changed')
    .map((line) => {
      const label = line.variationName ? `${line.name} – ${line.variationName}` : line.name
      const prefix = `${line.qty}x ${label} (cód. ${line.code})`
      if (line.unitCents === null) return `${prefix} – sob consulta`
      return `${prefix} – ${formatBRL(line.unitCents)} = ${formatBRL(line.subtotalCents!)}`
    })
  const title = orderCode ? `*Pedido #${orderCode}*` : '*Resumo*'
  return [title, '', ...lines, '', `*Total: ${formatOrderTotal(result.total)}*`].join('\n')
}

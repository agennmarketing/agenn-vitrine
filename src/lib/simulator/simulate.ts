import { addonMessageLines, addonsUnitCents, type AddonGroup, type AddonSelection } from '@/lib/addons/addons'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents, orderTotal, unitPriceCents, type PriceType } from '@/lib/pricing/price'

export type SimulatorItem = {
  id: string; code: string; name: string; vitrineName: string; deleted: boolean; soldOut: boolean
  priceType: PriceType; priceCents: number | null; promoPriceCents: number | null
  variations: { id: string; name: string; priceCents: number; promoPriceCents: number | null }[]
  addonGroups?: AddonGroup[]
}

export type SimulatorLineInput = {
  itemId: string
  variationId: string | null
  qty: number
  addons?: AddonSelection[]
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
  status: 'ok' | 'price_changed' | 'removed' | 'variation_removed' | 'addon_removed'
  previousUnitCents: number | null
  addonLines: string[]
}

export function simulateOrder(lines: readonly SimulatorLineInput[], items: ReadonlyMap<string, SimulatorItem>) {
  const simulated: SimulatedLine[] = lines.map((line) => {
    const item = items.get(line.itemId)
    const previousUnitCents = line.previousUnitCents ?? null
    const addons = line.addons ?? []
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
        addonLines: [],
      }
    }
    const groups = item.addonGroups ?? []
    const addonLines = addonMessageLines(groups, addons)
    const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
    if (line.variationId && !variation) {
      return {
        name: item.name, code: item.code, variationName: line.snapshotVariationName ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'variation_removed', previousUnitCents, addonLines,
      }
    }
    const knownOptions = new Set(groups.flatMap((group) => group.options.map((option) => option.id)))
    if (addons.some((addon) => !knownOptions.has(addon.optionId))) {
      return {
        name: item.name, code: item.code, variationName: variation?.name ?? null, qty: line.qty,
        unitCents: null, subtotalCents: null, status: 'addon_removed', previousUnitCents, addonLines,
      }
    }
    const base = unitPriceCents(item, variation ?? null)
    const unitCents = base === null ? null : base + addonsUnitCents(groups, addons)
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
      addonLines,
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
      variation: { id: string; name: string } | null
      addons?: { option_id: string; qty: number }[]
      unit_price_cents: number | null
      addons_unit_cents?: number
    }
    return {
      itemId: line.item_id,
      variationId: line.variation?.id ?? null,
      qty: line.qty,
      addons: (line.addons ?? []).map((addon) => ({ optionId: addon.option_id, qty: addon.qty })),
      previousUnitCents: line.unit_price_cents === null ? null : line.unit_price_cents + (line.addons_unit_cents ?? 0),
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
      const main = line.unitCents === null
        ? `${prefix} – sob consulta`
        : `${prefix} – ${formatBRL(line.unitCents)} = ${formatBRL(line.subtotalCents!)}`
      return [main, ...line.addonLines].join('\n')
    })
  const title = orderCode ? `*Pedido #${orderCode}*` : '*Resumo*'
  return [title, '', ...lines, '', `*Total: ${formatOrderTotal(result.total)}*`].join('\n')
}

import { z } from 'zod'
import { addonsUnitCents, validateAddonSelections, type AddonGroup } from '@/lib/addons/addons'
import { unitPriceCents, type PriceType } from '@/lib/pricing/price'

export const orderRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        variationId: z.uuid().nullable().default(null),
        qty: z.number().int().min(1).max(99),
        note: z.string().trim().max(140).default(''),
        addons: z
          .array(z.object({ optionId: z.uuid(), qty: z.number().int().min(1).max(20) }))
          .max(30)
          .default([]),
      }),
    )
    .min(1)
    .max(50),
})

export type OrderRequestLine = z.output<typeof orderRequestSchema>['lines'][number]

export type SnapshotSourceItem = {
  id: string
  code: string
  name: string
  price_type: PriceType
  price_cents: number | null
  promo_price_cents: number | null
  sold_out: boolean
  item_variations: { id: string; name: string; price_cents: number; promo_price_cents: number | null; sold_out: boolean }[]
  addon_groups: AddonGroup[]
}

export type SnapshotAddon = {
  group_id: string
  group_name: string
  option_id: string
  name: string
  qty: number
  price_cents: number
}

export type SnapshotLine = {
  item_id: string
  code: string
  name: string
  qty: number
  variation: { id: string; name: string } | null
  addons: SnapshotAddon[]
  note: string | null
  unit_price_cents: number | null
  addons_unit_cents: number
}

type BuildResult =
  | { ok: true; payload: { items: SnapshotLine[] } }
  | { ok: false; reason: 'item_not_found' | 'sold_out' | 'variation_required' | 'variation_not_found' | 'addons_invalid' }

// Nunca guarda dados pessoais (spec 4.5): só itens, escolhas e preços do momento.
export function buildSnapshotPayload(lines: readonly OrderRequestLine[], items: readonly SnapshotSourceItem[]): BuildResult {
  const byId = new Map(items.map((item) => [item.id, item]))
  const result: SnapshotLine[] = []
  for (const line of lines) {
    const item = byId.get(line.itemId)
    if (!item) return { ok: false, reason: 'item_not_found' }
    if (item.sold_out) return { ok: false, reason: 'sold_out' }

    let variation: SnapshotSourceItem['item_variations'][number] | null = null
    if (item.item_variations.length > 0) {
      if (!line.variationId) return { ok: false, reason: 'variation_required' }
      variation = item.item_variations.find((v) => v.id === line.variationId) ?? null
      if (!variation) return { ok: false, reason: 'variation_not_found' }
      if (variation.sold_out) return { ok: false, reason: 'sold_out' }
    }

    const check = validateAddonSelections(item.addon_groups, line.addons)
    if (!check.ok) return { ok: false, reason: 'addons_invalid' }
    const addons = check.selections.map((selection) => {
      const group = item.addon_groups.find((g) => g.options.some((option) => option.id === selection.optionId))!
      const option = group.options.find((o) => o.id === selection.optionId)!
      return {
        group_id: group.id,
        group_name: group.name,
        option_id: option.id,
        name: option.name,
        qty: selection.qty,
        price_cents: option.priceCents,
      }
    })

    result.push({
      item_id: item.id,
      code: item.code,
      name: item.name,
      qty: line.qty,
      variation: variation ? { id: variation.id, name: variation.name } : null,
      addons,
      note: line.note || null,
      unit_price_cents: unitPriceCents(
        { priceType: item.price_type, priceCents: item.price_cents, promoPriceCents: item.promo_price_cents },
        variation ? { priceCents: variation.price_cents, promoPriceCents: variation.promo_price_cents } : null,
      ),
      addons_unit_cents: addonsUnitCents(item.addon_groups, check.selections),
    })
  }
  return { ok: true, payload: { items: result } }
}

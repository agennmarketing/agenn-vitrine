import { z } from 'zod'
import { unitPriceCents, type PriceType } from '@/lib/pricing/price'

export const orderRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        variationId: z.uuid().nullable().default(null),
        qty: z.number().int().min(1).max(99),
        note: z.string().trim().max(140).default(''),
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
}

export type SnapshotLine = {
  item_id: string
  code: string
  name: string
  qty: number
  variation: { id: string; name: string } | null
  note: string | null
  unit_price_cents: number | null
}

type BuildResult =
  | { ok: true; payload: { items: SnapshotLine[] } }
  | { ok: false; reason: 'item_not_found' | 'sold_out' | 'variation_required' | 'variation_not_found' }

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

    result.push({
      item_id: item.id,
      code: item.code,
      name: item.name,
      qty: line.qty,
      variation: variation ? { id: variation.id, name: variation.name } : null,
      note: line.note || null,
      unit_price_cents: unitPriceCents(
        { priceType: item.price_type, priceCents: item.price_cents, promoPriceCents: item.promo_price_cents },
        variation ? { priceCents: variation.price_cents, promoPriceCents: variation.promo_price_cents } : null,
      ),
    })
  }
  return { ok: true, payload: { items: result } }
}

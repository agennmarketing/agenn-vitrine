import { describe, expect, it } from 'vitest'
import { buildSnapshotPayload, orderRequestSchema } from './snapshot'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const items = [
  { id: uuid(1), code: '101', name: 'Camiseta', price_type: 'fixed' as const, price_cents: 5000, promo_price_cents: 4500, sold_out: false, item_variations: [] },
  {
    id: uuid(2), code: '102', name: 'Manicure', price_type: 'fixed' as const, price_cents: null, promo_price_cents: null, sold_out: false,
    item_variations: [
      { id: uuid(20), name: 'Mão', price_cents: 3000, promo_price_cents: null, sold_out: false },
      { id: uuid(21), name: 'Pé', price_cents: 3500, promo_price_cents: null, sold_out: true },
    ],
  },
  { id: uuid(3), code: '103', name: 'Esgotado', price_type: 'on_request' as const, price_cents: null, promo_price_cents: null, sold_out: true, item_variations: [] },
]

describe('orderRequestSchema', () => {
  it('aplica padrões e limites', () => {
    expect(orderRequestSchema.parse({ lines: [{ itemId: uuid(1), qty: 1 }] })).toEqual({
      lines: [{ itemId: uuid(1), variationId: null, qty: 1, note: '' }],
    })
    expect(orderRequestSchema.safeParse({ lines: [] }).success).toBe(false)
    expect(orderRequestSchema.safeParse({ lines: [{ itemId: uuid(1), qty: 100 }] }).success).toBe(false)
  })
})

describe('buildSnapshotPayload', () => {
  it('usa nomes e preços atuais do banco, nunca do navegador', () => {
    const result = buildSnapshotPayload([{ itemId: uuid(1), variationId: null, qty: 2, note: '' }], items)
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [{ item_id: uuid(1), code: '101', name: 'Camiseta', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 4500 }],
      },
    })
  })

  it('variação obrigatória, existente e disponível', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'variation_required' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(99), qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'variation_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(21), qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'sold_out' })
    const ok = buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(20), qty: 1, note: 'sem pressa' }], items)
    expect(ok.ok && ok.payload.items[0]).toMatchObject({ variation: { id: uuid(20), name: 'Mão' }, unit_price_cents: 3000, note: 'sem pressa' })
  })

  it('item inexistente ou esgotado', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(9), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'item_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(3), variationId: null, qty: 1, note: '' }], items)).toEqual({ ok: false, reason: 'sold_out' })
  })
})

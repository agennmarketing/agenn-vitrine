import { describe, expect, it } from 'vitest'
import { buildSnapshotPayload, orderRequestSchema } from './snapshot'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const items = [
  { id: uuid(1), code: '101', name: 'Camiseta', price_type: 'fixed' as const, price_cents: 5000, promo_price_cents: 4500, sold_out: false, item_variations: [], addon_groups: [] },
  {
    id: uuid(2), code: '102', name: 'Manicure', price_type: 'fixed' as const, price_cents: null, promo_price_cents: null, sold_out: false,
    item_variations: [
      { id: uuid(20), name: 'Mão', price_cents: 3000, promo_price_cents: null, sold_out: false },
      { id: uuid(21), name: 'Pé', price_cents: 3500, promo_price_cents: null, sold_out: true },
    ],
    addon_groups: [],
  },
  { id: uuid(3), code: '103', name: 'Esgotado', price_type: 'on_request' as const, price_cents: null, promo_price_cents: null, sold_out: true, item_variations: [], addon_groups: [] },
]

describe('orderRequestSchema', () => {
  it('aplica padrões e limites', () => {
    expect(orderRequestSchema.parse({ lines: [{ itemId: uuid(1), qty: 1 }] })).toEqual({
      lines: [{ itemId: uuid(1), variationId: null, qty: 1, note: '', addons: [] }],
    })
    expect(orderRequestSchema.safeParse({ lines: [] }).success).toBe(false)
    expect(orderRequestSchema.safeParse({ lines: [{ itemId: uuid(1), qty: 100 }] }).success).toBe(false)
  })
})

describe('buildSnapshotPayload', () => {
  it('usa nomes e preços atuais do banco, nunca do navegador', () => {
    const result = buildSnapshotPayload([{ itemId: uuid(1), variationId: null, qty: 2, note: '', addons: [] }], items)
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [{ item_id: uuid(1), code: '101', name: 'Camiseta', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 4500, addons_unit_cents: 0 }],
      },
    })
  })

  it('variação obrigatória, existente e disponível', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: null, qty: 1, note: '', addons: [] }], items)).toEqual({ ok: false, reason: 'variation_required' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(99), qty: 1, note: '', addons: [] }], items)).toEqual({ ok: false, reason: 'variation_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(21), qty: 1, note: '', addons: [] }], items)).toEqual({ ok: false, reason: 'sold_out' })
    const ok = buildSnapshotPayload([{ itemId: uuid(2), variationId: uuid(20), qty: 1, note: 'sem pressa', addons: [] }], items)
    expect(ok.ok && ok.payload.items[0]).toMatchObject({ variation: { id: uuid(20), name: 'Mão' }, unit_price_cents: 3000, note: 'sem pressa' })
  })

  it('item inexistente ou esgotado', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(9), variationId: null, qty: 1, note: '', addons: [] }], items)).toEqual({ ok: false, reason: 'item_not_found' })
    expect(buildSnapshotPayload([{ itemId: uuid(3), variationId: null, qty: 1, note: '', addons: [] }], items)).toEqual({ ok: false, reason: 'sold_out' })
  })
})

describe('complementos', () => {
  const burger = {
    id: uuid(4), code: '104', name: 'X-Bacon', price_type: 'fixed' as const, price_cents: 2590, promo_price_cents: null, sold_out: false,
    item_variations: [],
    addon_groups: [
      {
        id: uuid(40), name: 'Ponto', kind: 'standard' as const, required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
        options: [{ id: uuid(41), name: 'Ao ponto', priceCents: 0, soldOut: false }],
      },
      {
        id: uuid(42), name: 'Adicionais', kind: 'standard' as const, required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
        options: [{ id: uuid(43), name: 'Bacon', priceCents: 400, soldOut: false }],
      },
    ],
  }

  it('grava complementos com preços do momento', () => {
    const result = buildSnapshotPayload(
      [{ itemId: uuid(4), variationId: null, qty: 2, note: 'sem cebola', addons: [{ optionId: uuid(43), qty: 2 }, { optionId: uuid(41), qty: 1 }] }],
      [burger],
    )
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [
          {
            item_id: uuid(4), code: '104', name: 'X-Bacon', qty: 2, variation: null, note: 'sem cebola',
            unit_price_cents: 2590, addons_unit_cents: 800,
            addons: [
              { group_id: uuid(40), group_name: 'Ponto', option_id: uuid(41), name: 'Ao ponto', qty: 1, price_cents: 0 },
              { group_id: uuid(42), group_name: 'Adicionais', option_id: uuid(43), name: 'Bacon', qty: 2, price_cents: 400 },
            ],
          },
        ],
      },
    })
  })

  it('escolha inválida é recusada', () => {
    expect(buildSnapshotPayload([{ itemId: uuid(4), variationId: null, qty: 1, note: '', addons: [] }], [burger])).toEqual({
      ok: false,
      reason: 'addons_invalid',
    })
    expect(
      buildSnapshotPayload([{ itemId: uuid(4), variationId: null, qty: 1, note: '', addons: [{ optionId: uuid(99), qty: 1 }] }], [burger]),
    ).toEqual({ ok: false, reason: 'addons_invalid' })
  })
})

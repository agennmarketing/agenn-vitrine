import { describe, expect, it } from 'vitest'
import { buildPricedSummary, linesFromSnapshot, simulateOrder, type SimulatorItem } from './simulate'

const items = new Map<string, SimulatorItem>([
  ['i1', { id: 'i1', code: '104', name: 'X-Bacon', vitrineName: 'Burger', deleted: false, soldOut: false, priceType: 'fixed', priceCents: 2590, promoPriceCents: null, variations: [] }],
  ['i2', {
    id: 'i2', code: '105', name: 'Camiseta', vitrineName: 'Loja', deleted: false, soldOut: false, priceType: 'fixed', priceCents: null, promoPriceCents: null,
    variations: [{ id: 'g', name: 'G', priceCents: 4490, promoPriceCents: 3990 }],
  }],
  ['i3', { id: 'i3', code: '106', name: 'Consulta', vitrineName: 'Loja', deleted: false, soldOut: false, priceType: 'on_request', priceCents: null, promoPriceCents: null, variations: [] }],
  ['i4', { id: 'i4', code: '107', name: 'Antigo', vitrineName: 'Loja', deleted: true, soldOut: false, priceType: 'fixed', priceCents: 1000, promoPriceCents: null, variations: [] }],
])

describe('simulateOrder', () => {
  it('soma com preços atuais e marca mudanças', () => {
    const result = simulateOrder(
      [
        { itemId: 'i1', variationId: null, qty: 2, previousUnitCents: 2390 },
        { itemId: 'i2', variationId: 'g', qty: 1, previousUnitCents: 3990 },
        { itemId: 'i3', variationId: null, qty: 1, previousUnitCents: null },
      ],
      items,
    )
    expect(result.lines.map((l) => [l.name, l.unitCents, l.subtotalCents, l.status])).toEqual([
      ['X-Bacon', 2590, 5180, 'price_changed'],
      ['Camiseta', 3990, 3990, 'ok'],
      ['Consulta', null, null, 'ok'],
    ])
    expect(result.total).toEqual({ totalCents: 9170, hasOnRequest: true })
    expect(result.hasChanges).toBe(true)
  })

  it('item ou variação removidos ficam fora do total', () => {
    const result = simulateOrder(
      [
        { itemId: 'i4', variationId: null, qty: 1, previousUnitCents: 1000, snapshotName: 'Antigo', snapshotCode: '107' },
        { itemId: 'i2', variationId: 'sumiu', qty: 1, previousUnitCents: 3000, snapshotVariationName: 'M' },
        { itemId: 'nao-existe', variationId: null, qty: 1, snapshotName: 'Fantasma', snapshotCode: '999' },
      ],
      items,
    )
    expect(result.lines.map((l) => [l.name, l.status, l.subtotalCents])).toEqual([
      ['Antigo', 'removed', null],
      ['Camiseta', 'variation_removed', null],
      ['Fantasma', 'removed', null],
    ])
    expect(result.total).toEqual({ totalCents: 0, hasOnRequest: false })
  })
})

it('linesFromSnapshot lê o payload gravado', () => {
  expect(
    linesFromSnapshot({
      items: [{ item_id: 'i1', code: '104', name: 'X-Bacon', qty: 2, variation: null, addons: [], note: null, unit_price_cents: 2390 }],
    }),
  ).toEqual([
    { itemId: 'i1', variationId: null, qty: 2, addons: [], previousUnitCents: 2390, snapshotName: 'X-Bacon', snapshotCode: '104', snapshotVariationName: null },
  ])
  expect(linesFromSnapshot(null)).toEqual([])
})

it('resumo com valores para colar no WhatsApp', () => {
  const result = simulateOrder(
    [
      { itemId: 'i1', variationId: null, qty: 2 },
      { itemId: 'i2', variationId: 'g', qty: 1 },
      { itemId: 'i3', variationId: null, qty: 1 },
    ],
    items,
  )
  expect(buildPricedSummary(result, 'K7F2')).toBe(
    [
      '*Pedido #K7F2*',
      '',
      '2x X-Bacon (cód. 104) – R$ 25,90 = R$ 51,80',
      '1x Camiseta – G (cód. 105) – R$ 39,90 = R$ 39,90',
      '1x Consulta (cód. 106) – sob consulta',
      '',
      '*Total: R$ 91,70 + itens sob consulta*',
    ].join('\n'),
  )
  expect(buildPricedSummary(result, null).startsWith('*Resumo*')).toBe(true)
})

describe('complementos', () => {
  const adicionais = {
    id: 'g', name: 'Adicionais', kind: 'standard' as const, required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
    options: [{ id: 'bacon', name: 'Bacon', priceCents: 500, soldOut: false }],
  }
  const burger: SimulatorItem = {
    id: 'b', code: '110', name: 'X-Bacon', vitrineName: 'Burger', deleted: false, soldOut: false, priceType: 'fixed',
    priceCents: 2590, promoPriceCents: null, variations: [], addonGroups: [adicionais],
  }
  const map = new Map([['b', burger]])

  it('preço atual inclui complementos e compara com o enviado', () => {
    const lines = linesFromSnapshot({
      items: [
        {
          item_id: 'b', code: '110', name: 'X-Bacon', qty: 2, variation: null, note: null, unit_price_cents: 2590, addons_unit_cents: 800,
          addons: [{ group_id: 'g', group_name: 'Adicionais', option_id: 'bacon', name: 'Bacon', qty: 2, price_cents: 400 }],
        },
      ],
    })
    expect(lines[0]).toMatchObject({ addons: [{ optionId: 'bacon', qty: 2 }], previousUnitCents: 3390 })
    const result = simulateOrder(lines, map)
    expect(result.lines[0]).toMatchObject({
      unitCents: 3590, subtotalCents: 7180, status: 'price_changed', addonLines: ['   • Adicionais: 2x Bacon'],
    })
    expect(buildPricedSummary(result, 'M4X9')).toBe(
      ['*Pedido #M4X9*', '', '2x X-Bacon (cód. 110) – R$ 35,90 = R$ 71,80', '   • Adicionais: 2x Bacon', '', '*Total: R$ 71,80*'].join('\n'),
    )
  })

  it('complemento apagado fica fora do total', () => {
    const result = simulateOrder([{ itemId: 'b', variationId: null, qty: 1, addons: [{ optionId: 'sumiu', qty: 1 }] }], map)
    expect(result.lines[0]).toMatchObject({ status: 'addon_removed', subtotalCents: null })
    expect(result.total).toEqual({ totalCents: 0, hasOnRequest: false })
  })
})

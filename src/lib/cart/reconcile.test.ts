import { describe, expect, it } from 'vitest'
import type { AddonGroup } from '@/lib/addons/addons'
import { addToCart } from './cart'
import { cartSummary, lineUnitCents, reconcileCart, type CartCatalogItem } from './reconcile'

const adicionais: AddonGroup = {
  id: 'g', name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
  options: [{ id: 'bacon', name: 'Bacon', priceCents: 400, soldOut: false }],
}

const xBacon: CartCatalogItem = {
  id: 'i1', code: '104', name: 'X-Bacon', priceType: 'fixed', priceCents: 2590, promoPriceCents: null, soldOut: false,
  variations: [], addonGroups: [adicionais],
}
const pizza: CartCatalogItem = {
  id: 'i2', code: '105', name: 'Pizza', priceType: 'fixed', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [{ id: 'grande', name: 'Grande', priceCents: 6000, promoPriceCents: 5500, soldOut: false }], addonGroups: [],
}
const consulta: CartCatalogItem = {
  id: 'i3', code: '106', name: 'Bolo sob encomenda', priceType: 'on_request', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [], addonGroups: [],
}
const items = new Map([xBacon, pizza, consulta].map((item) => [item.id, item]))

describe('preço e totais', () => {
  it('base mais complementos', () => {
    expect(lineUnitCents({ itemId: 'i1', variationId: null, qty: 1, note: '', addons: [{ optionId: 'bacon', qty: 2 }] }, xBacon)).toBe(3390)
    expect(lineUnitCents({ itemId: 'i2', variationId: 'grande', qty: 1, note: '', addons: [] }, pizza)).toBe(5500)
    expect(lineUnitCents({ itemId: 'i3', variationId: null, qty: 1, note: '', addons: [] }, consulta)).toBeNull()
  })

  it('resumo da sacola', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 2, note: '', addons: [{ optionId: 'bacon', qty: 1 }] })
    lines = addToCart(lines, { itemId: 'i3', variationId: null, qty: 1, note: '', addons: [] })
    expect(cartSummary(lines, items)).toEqual({ count: 3, total: { totalCents: 5980, hasOnRequest: true } })
  })
})

describe('reconcileCart (spec 7.4)', () => {
  it('remove itens apagados, esgotados, variação sumida ou complemento inválido e avisa', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'sumiu', variationId: null, qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'i2', variationId: 'pequena', qty: 1, note: '', addons: [] })
    lines = addToCart(lines, { itemId: 'i1', variationId: null, qty: 1, note: 'x', addons: [{ optionId: 'bacon', qty: 9 }] })

    const result = reconcileCart(lines, items)
    expect(result.lines.map((line) => line.itemId)).toEqual(['i1'])
    expect(result.removedNames).toEqual(['Um item', 'Pizza', 'X-Bacon'])

    const soldOut = new Map(items).set('i1', { ...xBacon, soldOut: true })
    expect(reconcileCart(result.lines, soldOut)).toEqual({ lines: [], removedNames: ['X-Bacon'] })
  })
})

import { describe, expect, it } from 'vitest'
import { addToCart } from './cart'
import { cartSummary, lineUnitCents, reconcileCart, type CartCatalogItem } from './reconcile'

const camiseta: CartCatalogItem = {
  id: 'i1', code: '104', name: 'Camiseta', priceType: 'fixed', priceCents: 2590, promoPriceCents: null, soldOut: false,
  variations: [],
}
const tenis: CartCatalogItem = {
  id: 'i2', code: '105', name: 'Tênis', priceType: 'fixed', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [{ id: 'azul', name: 'Azul', priceCents: 6000, promoPriceCents: 5500, soldOut: false }],
}
const consulta: CartCatalogItem = {
  id: 'i3', code: '106', name: 'Móvel sob medida', priceType: 'on_request', priceCents: null, promoPriceCents: null, soldOut: false,
  variations: [],
}
const items = new Map([camiseta, tenis, consulta].map((item) => [item.id, item]))

describe('preço e totais', () => {
  it('preço do item ou da variação escolhida', () => {
    expect(lineUnitCents({ itemId: 'i1', variationId: null, qty: 1, note: '' }, camiseta)).toBe(2590)
    expect(lineUnitCents({ itemId: 'i2', variationId: 'azul', qty: 1, note: '' }, tenis)).toBe(5500)
    expect(lineUnitCents({ itemId: 'i3', variationId: null, qty: 1, note: '' }, consulta)).toBeNull()
  })

  it('resumo da sacola', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 2, note: '' })
    lines = addToCart(lines, { itemId: 'i3', variationId: null, qty: 1, note: '' })
    expect(cartSummary(lines, items)).toEqual({ count: 3, total: { totalCents: 5180, hasOnRequest: true } })
  })
})

describe('reconcileCart (spec 7.4)', () => {
  it('remove itens apagados, esgotados ou com variação sumida e avisa', () => {
    let lines = addToCart([], { itemId: 'i1', variationId: null, qty: 1, note: '' })
    lines = addToCart(lines, { itemId: 'sumiu', variationId: null, qty: 1, note: '' })
    lines = addToCart(lines, { itemId: 'i2', variationId: 'vermelho', qty: 1, note: '' })

    const result = reconcileCart(lines, items)
    expect(result.lines.map((line) => line.itemId)).toEqual(['i1'])
    expect(result.removedNames).toEqual(['Um item', 'Tênis'])

    const soldOut = new Map(items).set('i1', { ...camiseta, soldOut: true })
    expect(reconcileCart(result.lines, soldOut)).toEqual({ lines: [], removedNames: ['Camiseta'] })
  })
})

import { describe, expect, it } from 'vitest'
import { formatOrderTotal, formatPriceLabel, lineTotalCents, orderTotal, priceLabel, unitPriceCents } from './price'

const fixed = { priceType: 'fixed' as const, priceCents: 2000, promoPriceCents: null }
const promo = { priceType: 'fixed' as const, priceCents: 2000, promoPriceCents: 1500 }
const onRequest = { priceType: 'on_request' as const, priceCents: null, promoPriceCents: null }

describe('unitPriceCents (4.6.1)', () => {
  it('usa o preço do item e a promoção quando houver', () => {
    expect(unitPriceCents(fixed)).toBe(2000)
    expect(unitPriceCents(promo)).toBe(1500)
  })

  it('variação substitui o preço do item', () => {
    expect(unitPriceCents(promo, { priceCents: 3000, promoPriceCents: null })).toBe(3000)
    expect(unitPriceCents(fixed, { priceCents: 3000, promoPriceCents: 2500 })).toBe(2500)
  })

  it('sob consulta não tem preço', () => {
    expect(unitPriceCents(onRequest)).toBeNull()
    expect(unitPriceCents(onRequest, { priceCents: 3000, promoPriceCents: null })).toBeNull()
  })
})

describe('totais (4.6.4 e 4.6.5)', () => {
  it('linha multiplica pela quantidade', () => {
    expect(lineTotalCents(1500, 3)).toBe(4500)
    expect(lineTotalCents(1500, 2, 250)).toBe(3500)
    expect(lineTotalCents(null, 2)).toBeNull()
  })

  it('pedido soma e marca itens sob consulta', () => {
    expect(orderTotal([4500, null, 1000])).toEqual({ totalCents: 5500, hasOnRequest: true })
    expect(orderTotal([4500])).toEqual({ totalCents: 4500, hasOnRequest: false })
    expect(formatOrderTotal({ totalCents: 5500, hasOnRequest: true })).toBe('R$ 55,00 + itens sob consulta')
    expect(formatOrderTotal({ totalCents: 0, hasOnRequest: true })).toBe('Itens sob consulta')
  })
})

describe('priceLabel', () => {
  it('fixo, promoção e a partir de', () => {
    expect(priceLabel(fixed)).toEqual({ kind: 'price', fromPrefix: false, cents: 2000, originalCents: null })
    expect(priceLabel(promo)).toEqual({ kind: 'price', fromPrefix: false, cents: 1500, originalCents: 2000 })
    expect(formatPriceLabel(priceLabel({ ...fixed, priceType: 'from' }))).toBe('A partir de R$ 20,00')
  })

  it('sob consulta', () => {
    expect(formatPriceLabel(priceLabel(onRequest))).toBe('Sob consulta')
  })

  it('variações com preços diferentes mostram o menor com "A partir de"', () => {
    const label = priceLabel(fixed, [
      { priceCents: 3000, promoPriceCents: null },
      { priceCents: 2500, promoPriceCents: 2200 },
    ])
    expect(label).toEqual({ kind: 'price', fromPrefix: true, cents: 2200, originalCents: null })
  })

  it('variações com o mesmo preço mostram o preço sem prefixo', () => {
    const label = priceLabel(fixed, [
      { priceCents: 3000, promoPriceCents: 2500 },
      { priceCents: 2500, promoPriceCents: null },
    ])
    expect(label).toEqual({ kind: 'price', fromPrefix: false, cents: 2500, originalCents: null })
  })
})

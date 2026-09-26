import { describe, expect, it } from 'vitest'
import { monthlyPriceLabel } from './prices'

//  : o Intl de BRL separa o símbolo do valor com espaço não separável.
describe('monthlyPriceLabel', () => {
  it('usa o preço mensal do Stripe', () => {
    expect(monthlyPriceLabel([{ id: 'price_mes', interval: 'month', amountCents: 6990 }])).toBe('R$ 69,90 por mês')
  })

  it('sem o Stripe, mostra o preço de referência', () => {
    expect(monthlyPriceLabel([])).toBe('R$ 69,90 por mês')
  })
})

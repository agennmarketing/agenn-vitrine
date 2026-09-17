import { describe, expect, it } from 'vitest'
import { priceCards } from './prices'

const MONTH = { id: 'price_mes', interval: 'month' as const, amountCents: 14990 }
const YEAR = { id: 'price_ano', interval: 'year' as const, amountCents: 149900 }

//  : o Intl de BRL separa o símbolo do valor com espaço não separável.
describe('priceCards', () => {
  it('monta os dois cartões na ordem mensal, anual', () => {
    expect(priceCards([YEAR, MONTH])).toEqual([
      {
        interval: 'month',
        priceId: 'price_mes',
        amountCents: 14990,
        title: 'R$ 149,90 por mês',
        note: 'Cobrança mensal no cartão. Cancele quando quiser.',
      },
      {
        interval: 'year',
        priceId: 'price_ano',
        amountCents: 149900,
        title: 'R$ 1.499,00 por ano',
        note: 'Economize 17% em relação ao mensal.',
      },
    ])
  })

  it('sem o mensal, o anual não fala em economia', () => {
    expect(priceCards([YEAR])[0].note).toBe('Cobrança anual no cartão.')
  })

  it('sem preços, sem cartões', () => {
    expect(priceCards([])).toEqual([])
  })
})

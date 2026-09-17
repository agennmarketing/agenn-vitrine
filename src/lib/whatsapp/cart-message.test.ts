import { describe, expect, it } from 'vitest'
import { buildCartMessage, withNoteLine } from './cart-message'

const retiradaAna = {
  name: 'Ana', fulfillment: 'retirada' as const, address: null, payment: 'Pix', changeForCents: null, schedule: null, notes: null,
}

describe('buildCartMessage (spec 7.5)', () => {
  it('exemplo da spec', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Burger do Zé',
        orderCode: 'K7F2',
        lines: [
          {
            qty: 2, itemName: 'X-Bacon', variationName: null, code: '104',
            addonLines: ['   • Ponto: Ao ponto', '   • Adicionais: 2x Bacon, 1x Cheddar'], note: 'sem cebola',
          },
          { qty: 1, itemName: 'Coca-Cola lata', variationName: null, code: '210', addonLines: [], note: null },
        ],
        checkout: retiradaAna,
      }),
    ).toBe(
      [
        '*Pedido #K7F2 – Burger do Zé*',
        '',
        '2x *X-Bacon* (cód. 104)',
        '   • Ponto: Ao ponto',
        '   • Adicionais: 2x Bacon, 1x Cheddar',
        '   • Obs: sem cebola',
        '',
        '1x *Coca-Cola lata* (cód. 210)',
        '',
        'Retirada · Nome: Ana · Pagamento: Pix',
      ].join('\n'),
    )
  })

  it('sem código, variação, entrega, troco, agendamento e observação geral', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Pizzaria',
        orderCode: null,
        lines: [{ qty: 1, itemName: 'Pizza', variationName: 'Grande', code: '301', addonLines: [], note: null }],
        checkout: {
          name: 'Bia', fulfillment: 'entrega', address: 'Rua A, 10', payment: 'Dinheiro', changeForCents: 10000,
          schedule: { date: '2026-09-20', time: '19:30' }, notes: 'Portão azul',
        },
      }),
    ).toBe(
      [
        '*Pedido – Pizzaria*',
        '',
        '1x *Pizza – Grande* (cód. 301)',
        '',
        'Entrega · Endereço: Rua A, 10 · Nome: Bia · Pagamento: Dinheiro (troco para R$ 100,00) · Agendado para 20/09 às 19:30 · Obs: Portão azul',
      ].join('\n'),
    )
  })

  it('formulário vazio não gera rodapé', () => {
    const empty = { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null }
    expect(
      buildCartMessage({
        vitrineName: 'Loja',
        orderCode: 'AB23',
        lines: [{ qty: 1, itemName: 'Camiseta', variationName: null, code: '101', addonLines: [], note: null }],
        checkout: empty,
      }),
    ).toBe('*Pedido #AB23 – Loja*\n\n1x *Camiseta* (cód. 101)')
  })
})

it('withNoteLine acrescenta a observação do item', () => {
  expect(withNoteLine(['   • Ponto: Ao ponto'], 'sem sal')).toEqual(['   • Ponto: Ao ponto', '   • Obs: sem sal'])
  expect(withNoteLine([], null)).toEqual([])
})

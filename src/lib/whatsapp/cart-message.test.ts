import { describe, expect, it } from 'vitest'
import { buildCartMessage } from './cart-message'

const retiradaAna = {
  name: 'Ana', fulfillment: 'retirada' as const, address: null, payment: 'Pix', changeForCents: null, schedule: null, notes: null,
}

describe('buildCartMessage', () => {
  it('produtos, variações, quantidade, valores, total e observações', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Loja da Ana',
        orderCode: 'K7F2',
        lines: [
          { qty: 2, itemName: 'Camiseta básica', variationName: 'Tamanho M', code: '104', unitCents: 4990, note: 'sem estampa' },
          { qty: 1, itemName: 'Caneca', variationName: null, code: '210', unitCents: 2500, note: null },
        ],
        checkout: retiradaAna,
      }),
    ).toBe(
      [
        '*Pedido #K7F2 – Loja da Ana*',
        '',
        '*1.* 2x Camiseta básica – Tamanho M',
        'cód. 104 · R$ 49,90 cada · total R$ 99,80',
        'Obs: sem estampa',
        '',
        '*2.* 1x Caneca',
        'cód. 210 · R$ 25,00 cada · total R$ 25,00',
        '',
        '*Total: R$ 124,80*',
        '',
        'Nome: Ana\nEntrega: retirada\nPagamento: Pix',
      ].join('\n'),
    )
  })

  it('sem código, com entrega, troco, agendamento e observação geral', () => {
    expect(
      buildCartMessage({
        vitrineName: 'Loja',
        orderCode: null,
        lines: [{ qty: 1, itemName: 'Tênis', variationName: 'Azul', code: '301', unitCents: 19900, note: null }],
        checkout: {
          name: 'Bia', fulfillment: 'entrega', address: 'Rua A, 10', payment: 'Dinheiro', changeForCents: 30000,
          schedule: { date: '2026-09-20', time: '19:30' }, notes: 'Portão azul',
        },
      }),
    ).toBe(
      [
        '*Pedido – Loja*',
        '',
        '*1.* 1x Tênis – Azul',
        'cód. 301 · R$ 199,00 cada · total R$ 199,00',
        '',
        '*Total: R$ 199,00*',
        '',
        'Nome: Bia',
        'Entrega: entrega',
        'Endereço: Rua A, 10',
        'Pagamento: Dinheiro (troco para R$ 300,00)',
        'Agendado para 20/09 às 19:30',
        'Observações: Portão azul',
      ].join('\n'),
    )
  })

  it('formulário vazio não gera rodapé', () => {
    const empty = { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null }
    expect(
      buildCartMessage({
        vitrineName: 'Loja',
        orderCode: 'AB23',
        lines: [{ qty: 1, itemName: 'Camiseta', variationName: null, code: '101', unitCents: 5000, note: null }],
        checkout: empty,
      }),
    ).toBe('*Pedido #AB23 – Loja*\n\n*1.* 1x Camiseta\ncód. 101 · R$ 50,00 cada · total R$ 50,00\n\n*Total: R$ 50,00*')
  })

  it('sem preço no item (vitrine sem preços ou sob consulta) não soma total', () => {
    const empty = { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null }
    expect(
      buildCartMessage({
        vitrineName: 'Loja',
        orderCode: null,
        lines: [{ qty: 3, itemName: 'Camiseta', variationName: null, code: '101', unitCents: null, note: null }],
        checkout: empty,
      }),
    ).toBe('*Pedido – Loja*\n\n*1.* 3x Camiseta\ncód. 101')
  })
})

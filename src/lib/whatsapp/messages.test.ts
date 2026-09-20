import { describe, expect, it } from 'vitest'
import { buildDirectMessage, buildWhatsAppUrl } from './messages'

const base = {
  vitrineName: 'Loja da Ana',
  itemName: 'Camiseta',
  itemCode: '104',
  variationName: null,
  orderCode: 'K7F2',
  customTemplate: null,
}

describe('mensagem automática do botão direto (7.5)', () => {
  it('Produtos', () => {
    expect(buildDirectMessage({ ...base, vitrineType: 'produtos' })).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104). Pedido #K7F2',
    )
  })

  it('Serviços com variação', () => {
    expect(
      buildDirectMessage({ ...base, vitrineType: 'servicos', itemName: 'Manicure', variationName: 'Pé e mão' }),
    ).toBe('Olá! Vim da vitrine *Loja da Ana* e gostaria de agendar: *Manicure – Pé e mão* (cód. 104). Pedido #K7F2')
  })

  it('sem código de pedido (falha ao criar)', () => {
    expect(buildDirectMessage({ ...base, vitrineType: 'produtos', orderCode: null })).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104).',
    )
  })

  it('serviço: preço e o que o cliente preencheu na etapa', () => {
    expect(
      buildDirectMessage({
        ...base,
        vitrineType: 'servicos',
        itemName: 'Corte de cabelo',
        request: { priceText: 'A partir de R$ 50,00', name: 'Maria', date: '2026-10-05', time: '14:30' },
        note: 'bem curto',
      }),
    ).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e gostaria de agendar: *Corte de cabelo* (cód. 104). Pedido #K7F2\n\n' +
        'Valor: A partir de R$ 50,00\nNome: Maria\nData desejada: 05/10\nHorário desejado: 14:30\n\nObs: bem curto',
    )
  })

  it('serviço: data, horário e preço ficam de fora quando não há', () => {
    expect(
      buildDirectMessage({
        ...base,
        vitrineType: 'servicos',
        itemName: 'Corte de cabelo',
        request: { priceText: null, name: 'Maria', date: null, time: null },
      }),
    ).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e gostaria de agendar: *Corte de cabelo* (cód. 104). Pedido #K7F2\n\nNome: Maria',
    )
  })

  it('a observação do cliente vai ao final', () => {
    expect(buildDirectMessage({ ...base, vitrineType: 'produtos', note: 'tamanho G' })).toBe(
      'Olá! Vim da vitrine *Loja da Ana* e tenho interesse em: *Camiseta* (cód. 104). Pedido #K7F2\n\nObs: tamanho G',
    )
  })
})

describe('mensagem personalizada', () => {
  it('substitui as variáveis', () => {
    expect(
      buildDirectMessage({
        ...base,
        vitrineType: 'produtos',
        variationName: 'G',
        customTemplate: 'Quero {item} ({variacao}) cód {codigo} da {vitrine}. #{pedido}',
      }),
    ).toBe('Quero Camiseta (G) cód 104 da Loja da Ana. #K7F2')
  })

  it('variáveis sem valor ficam vazias', () => {
    expect(
      buildDirectMessage({ ...base, vitrineType: 'produtos', orderCode: null, customTemplate: 'Oi {item} {variacao} #{pedido}' }),
    ).toBe('Oi Camiseta  #')
  })
})

it('link do WhatsApp com texto codificado', () => {
  expect(buildWhatsAppUrl('+5511987654321', 'Olá! *X* & Y')).toBe(
    'https://wa.me/5511987654321?text=Ol%C3%A1!%20*X*%20%26%20Y',
  )
})

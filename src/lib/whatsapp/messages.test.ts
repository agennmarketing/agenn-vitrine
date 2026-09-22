import { describe, expect, it } from 'vitest'
import { buildBookingMessage, buildDirectMessage, buildWhatsAppUrl } from './messages'

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

describe('aviso do agendamento no WhatsApp', () => {
  const booking = {
    vitrineName: 'Studio',
    serviceName: 'Manicure',
    date: '2030-01-07',
    time: '09:30',
    priceText: 'R$ 40,00',
    customerName: 'Maria',
    code: 'AB23',
    notes: null,
  }

  it('resume serviço, data, valor, nome e código', () => {
    expect(buildBookingMessage(booking)).toBe(
      'Olá! Acabei de agendar pela vitrine *Studio*:\n\n*Manicure*\nData: segunda, 07/01 às 09:30\nValor: R$ 40,00\nNome: Maria\nAgendamento #AB23',
    )
  })

  it('sem valor e com observação', () => {
    expect(buildBookingMessage({ ...booking, priceText: null, notes: 'unha curta' })).toBe(
      'Olá! Acabei de agendar pela vitrine *Studio*:\n\n*Manicure*\nData: segunda, 07/01 às 09:30\nNome: Maria\nAgendamento #AB23\n\nObs: unha curta',
    )
  })
})

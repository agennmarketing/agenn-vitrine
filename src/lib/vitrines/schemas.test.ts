import { describe, expect, it } from 'vitest'
import { bookingBlockSchema, bookingRulesSchema, checkoutSettingsSchema, createVitrineSchema, itemSchema, vitrineSettingsSchema } from './schemas'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('createVitrineSchema', () => {
  const hours = JSON.stringify([{ day: 1, open: '09:00', close: '18:00' }])
  const servico = {
    type: 'servicos',
    serviceSegment: 'nail',
    name: ' Studio Ana ',
    subdomain: ' Studio-Ana ',
    whatsappLabel: '',
    whatsappPhone: '(11) 98765-4321',
    instagram: 'https://www.instagram.com/Studio.Ana/',
    address: '  ',
    businessHours: hours,
    theme: 'dark',
  }

  it('normaliza subdomínio, telefone e Instagram', () => {
    expect(createVitrineSchema.parse(servico)).toEqual({
      type: 'servicos',
      serviceSegment: 'nail',
      name: 'Studio Ana',
      subdomain: 'studio-ana',
      whatsappLabel: 'Principal',
      whatsappPhone: '+5511987654321',
      instagram: 'studio.ana',
      address: null,
      businessHours: [{ day: 1, open: '09:00', close: '18:00' }],
      theme: 'dark',
    })
    expect(createVitrineSchema.parse({ ...servico, instagram: '@ana_nails' }).instagram).toBe('ana_nails')
    expect(createVitrineSchema.parse({ ...servico, instagram: '' }).instagram).toBeNull()
  })

  it('vitrine de produtos não tem segmento nem horários', () => {
    const parsed = createVitrineSchema.parse({
      ...servico,
      type: 'produtos',
      serviceSegment: '',
      businessHours: '[]',
    })
    expect(parsed.serviceSegment).toBeNull()
    expect(parsed.businessHours).toBeNull()
  })

  it('serviços exigem segmento e pelo menos um dia de atendimento', () => {
    const result = createVitrineSchema.safeParse({ ...servico, serviceSegment: '', businessHours: '[]' })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]))
    expect(messages).toEqual({
      serviceSegment: 'Escolha o tipo do seu negócio.',
      businessHours: 'Marque pelo menos um dia de atendimento.',
    })
  })

  it('mensagens em português', () => {
    const result = createVitrineSchema.safeParse({
      ...servico,
      type: 'padaria',
      name: '',
      subdomain: 'app',
      whatsappLabel: 'Principal',
      whatsappPhone: '123',
      instagram: 'ana nails!',
      address: '',
      businessHours: JSON.stringify([{ day: 1, open: '18:00', close: '09:00' }]),
    })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]))
    expect(messages).toMatchObject({
      type: 'Escolha o tipo da vitrine.',
      name: 'Informe o nome da vitrine.',
      subdomain: 'Este endereço é reservado. Escolha outro.',
      whatsappPhone: 'Informe um WhatsApp válido com DDD.',
      instagram: 'Informe um Instagram válido. Ex.: @seuestudio',
      businessHours: 'O horário de abrir deve ser antes do de fechar.',
    })
  })
})

describe('vitrineSettingsSchema', () => {
  it('formato do subdomínio', () => {
    const result = vitrineSettingsSchema.safeParse({ name: 'X', description: '', subdomain: '-ab' })
    expect(result.error!.issues[0].message).toBe(
      'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
    )
  })
})

describe('itemSchema', () => {
  const valid = {
    name: 'Camiseta',
    description: '',
    categoryId: uuid,
    code: '',
    priceType: 'fixed',
    price: '49,90',
    promoPrice: '',
    durationMinutes: '',
    tags: 'algodão, novo , algodão',
    soldOut: '',
    whatsappId: '',
    buttonText: '',
    customMessage: '',
    notice: '',
    variations: '[]',
    coverMediaId: uuid,
    galleryMediaIds: '[]',
    videoMediaId: '',
  }

  it('vídeo do item é opcional', () => {
    expect(itemSchema.parse(valid).videoMediaId).toBeNull()
    expect(itemSchema.parse({ ...valid, videoMediaId: uuid }).videoMediaId).toBe(uuid)
  })

  it('converte os campos do formulário', () => {
    const parsed = itemSchema.parse(valid)
    expect(parsed).toMatchObject({
      name: 'Camiseta',
      code: null,
      priceCents: 4990,
      promoPriceCents: null,
      durationMinutes: null,
      tags: ['algodão', 'novo'],
      soldOut: false,
      whatsappId: null,
      buttonText: null,
      customMessage: null,
      notice: null,
      variations: [],
    })
  })

  it('exige preço sem variações e promoção menor que o preço', () => {
    const noPrice = itemSchema.safeParse({ ...valid, price: '' })
    expect(noPrice.error!.issues[0]).toMatchObject({ path: ['price'], message: 'Informe o preço.' })
    const badPromo = itemSchema.safeParse({ ...valid, promoPrice: '60,00' })
    expect(badPromo.error!.issues[0]).toMatchObject({
      path: ['promoPrice'],
      message: 'O preço promocional deve ser menor que o preço.',
    })
  })

  it('variações dispensam o preço do item', () => {
    const parsed = itemSchema.parse({
      ...valid,
      price: '',
      variations: JSON.stringify([{ name: 'P', price: '39,90', promoPrice: '', soldOut: false }]),
    })
    expect(parsed.priceCents).toBeNull()
    expect(parsed.variations).toEqual([{ id: null, name: 'P', priceCents: 3990, promoPriceCents: null, soldOut: false }])
  })

  it('sob consulta zera os preços', () => {
    const parsed = itemSchema.parse({ ...valid, priceType: 'on_request', price: '10,00' })
    expect(parsed.priceCents).toBeNull()
  })

  it('código personalizado é normalizado', () => {
    expect(itemSchema.parse({ ...valid, code: ' x 1 ' }).code).toBe('X1')
    expect(itemSchema.safeParse({ ...valid, code: 'ABCDEFG' }).error!.issues[0].message).toBe('Use até 6 letras ou números.')
  })
})

describe('checkoutSettingsSchema', () => {
  const form = {
    cartEnabled: 'on', cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
    nameMode: 'required', phoneMode: 'optional', fulfillmentMode: 'required', allowPickup: 'on', allowDelivery: 'on',
    paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
    paymentOptions: 'Pix\nCartão na entrega\n\nPix\nDinheiro', extraNote: '  ',
  }

  it('converte as formas de pagamento (uma por linha)', () => {
    expect(checkoutSettingsSchema.parse(form)).toEqual({
      cartEnabled: true, cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
      nameMode: 'required', phoneMode: 'optional', fulfillmentMode: 'required', allowPickup: true, allowDelivery: true,
      paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
      paymentOptions: ['Pix', 'Cartão na entrega', 'Dinheiro'], extraNote: null,
    })
  })

  it('pagamento ligado exige ao menos uma forma', () => {
    expect(checkoutSettingsSchema.safeParse({ ...form, paymentOptions: ' ' }).error!.issues[0]).toMatchObject({
      path: ['paymentOptions'],
      message: 'Informe pelo menos uma forma de pagamento.',
    })
    expect(checkoutSettingsSchema.parse({ ...form, paymentMode: 'off', paymentOptions: '' }).paymentOptions).toEqual([])
  })
})

describe('agenda', () => {
  const hours = JSON.stringify([{ day: 1, open: '09:00', close: '18:00' }])

  it('regras aceitam só as opções da tela', () => {
    expect(bookingRulesSchema.parse({ businessHours: hours, bufferMinutes: '15', minNoticeMinutes: '60', maxDaysAhead: '30' })).toEqual({
      businessHours: [{ day: 1, open: '09:00', close: '18:00' }],
      bufferMinutes: 15,
      minNoticeMinutes: 60,
      maxDaysAhead: 30,
    })
    expect(bookingRulesSchema.safeParse({ businessHours: hours, bufferMinutes: '7', minNoticeMinutes: '60', maxDaysAhead: '30' }).success).toBe(false)
  })

  it('bloqueio de trecho exige fim depois do início; dia inteiro ignora horários', () => {
    const base = { date: '2030-01-07', start: '13:00', end: '12:00', reason: '' }
    expect(bookingBlockSchema.safeParse({ ...base, allDay: '' }).error!.issues[0].message).toBe('O fim deve ser depois do início.')
    expect(bookingBlockSchema.parse({ ...base, allDay: 'on' })).toMatchObject({ allDay: true, reason: null })
  })
})

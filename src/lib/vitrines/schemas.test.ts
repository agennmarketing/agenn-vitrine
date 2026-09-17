import { describe, expect, it } from 'vitest'
import { addonGroupSchema, checkoutSettingsSchema, createVitrineSchema, itemSchema, vitrineSettingsSchema } from './schemas'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('createVitrineSchema', () => {
  it('normaliza subdomínio e telefone', () => {
    const parsed = createVitrineSchema.parse({
      type: 'produtos',
      name: ' Loja da Ana ',
      subdomain: ' Loja-Ana ',
      whatsappLabel: '',
      whatsappPhone: '(11) 98765-4321',
      theme: 'dark',
    })
    expect(parsed).toEqual({
      type: 'produtos',
      name: 'Loja da Ana',
      subdomain: 'loja-ana',
      whatsappLabel: 'Principal',
      whatsappPhone: '+5511987654321',
      theme: 'dark',
    })
  })

  it('mensagens em português', () => {
    const result = createVitrineSchema.safeParse({
      type: 'bebidas',
      name: '',
      subdomain: 'app',
      whatsappLabel: 'Principal',
      whatsappPhone: '123',
      theme: 'light',
    })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]))
    expect(messages).toMatchObject({
      type: 'Escolha o tipo da vitrine.',
      name: 'Informe o nome da vitrine.',
      subdomain: 'Este endereço é reservado. Escolha outro.',
      whatsappPhone: 'Informe um WhatsApp válido com DDD.',
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
    variations: '[]',
    coverMediaId: uuid,
    galleryMediaIds: '[]',
    videoMediaId: '',
    addonGroupIds: '[]',
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
      variations: [],
      addonGroupIds: [],
    })
  })

  it('grupos de complementos são opcionais no formulário', () => {
    const withoutGroups: Partial<typeof valid> = { ...valid }
    delete withoutGroups.addonGroupIds
    expect(itemSchema.parse(withoutGroups).addonGroupIds).toEqual([])
    expect(itemSchema.parse({ ...valid, addonGroupIds: JSON.stringify([uuid]) }).addonGroupIds).toEqual([uuid])
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

describe('addonGroupSchema', () => {
  const group = {
    name: 'Adicionais', kind: 'standard', required: '', minSelect: '0', maxSelect: '5', allowRepeat: 'on', flavorPriceRule: '',
    options: JSON.stringify([{ name: 'Bacon', price: '4,00', soldOut: false }]),
  }

  it('converte e normaliza', () => {
    expect(addonGroupSchema.parse(group)).toEqual({
      name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
      options: [{ id: null, name: 'Bacon', priceCents: 400, soldOut: false }],
    })
  })

  it('obrigatório força mínimo 1; sabores não repetem e exigem regra', () => {
    expect(addonGroupSchema.parse({ ...group, required: 'on', minSelect: '0' }).minSelect).toBe(1)
    expect(addonGroupSchema.parse({ ...group, kind: 'flavors', flavorPriceRule: 'average' })).toMatchObject({ allowRepeat: false, flavorPriceRule: 'average' })
    expect(addonGroupSchema.safeParse({ ...group, kind: 'flavors' }).error!.issues[0].message).toBe('Escolha a regra de preço dos sabores.')
  })

  it('mensagens', () => {
    expect(addonGroupSchema.safeParse({ ...group, options: '[]' }).error!.issues[0].message).toBe('Adicione pelo menos uma opção.')
    expect(addonGroupSchema.safeParse({ ...group, required: 'on', minSelect: '6' }).error!.issues[0].message).toBe(
      'O mínimo não pode passar do máximo.',
    )
    expect(addonGroupSchema.safeParse({ ...group, maxSelect: '0' }).error!.issues[0].message).toBe('Informe um número de 1 a 20.')
  })
})

describe('checkoutSettingsSchema', () => {
  const form = {
    cartEnabled: 'on', cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
    nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
    paymentOptions: 'Pix\nCartão na entrega\n\nPix\nDinheiro',
  }

  it('converte as formas de pagamento (uma por linha)', () => {
    expect(checkoutSettingsSchema.parse(form)).toEqual({
      cartEnabled: true, cartButtonText: 'Enviar pedido', defaultButtonText: 'Pedir',
      nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'off', notesMode: 'optional',
      paymentOptions: ['Pix', 'Cartão na entrega', 'Dinheiro'],
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

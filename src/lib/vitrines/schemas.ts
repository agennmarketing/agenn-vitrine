import { z } from 'zod'
import { BUFFER_OPTIONS, MAX_DAYS_OPTIONS, MIN_NOTICE_OPTIONS } from '@/lib/booking/rules'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { validateSubdomain } from '@/lib/hosts/subdomain'
import { parseBRLToCents } from '@/lib/money/money'
import { normalizePhone } from '@/lib/whatsapp/phone'
import { isServiceSegment } from './service-segments'
import { WIZARD_VITRINE_TYPES } from './vitrine-types'

const SUBDOMAIN_MESSAGES = {
  length: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  format: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  reserved: 'Este endereço é reservado. Escolha outro.',
} as const

export const SUBDOMAIN_TAKEN_MESSAGE = 'Este endereço já está em uso. Escolha outro.'

export const subdomainField = z.string().transform((value, ctx) => {
  const result = validateSubdomain(value)
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: SUBDOMAIN_MESSAGES[result.reason] })
    return z.NEVER
  }
  return result.value
})

const vitrineName = z.string().trim().min(1, 'Informe o nome da vitrine.').max(60, 'Use até 60 caracteres.')
const theme = z.enum(['light', 'dark'], 'Escolha o tema.')
const checkbox = z.string().optional().transform((value) => value === 'on' || value === 'true')

const fieldMode = z.enum(['off', 'optional', 'required'], 'Escolha uma opção.')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => value || null)

const phone = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value)
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Informe um WhatsApp válido com DDD.' })
    return z.NEVER
  }
  return normalized
})

const contactLabel = z
  .string()
  .trim()
  .max(40, 'Use até 40 caracteres.')
  .transform((value) => value || 'Principal')

// Aceita "@usuario", "usuario" ou o link do perfil; guarda só o usuário, em minúsculas.
const instagram = z.string().transform((value, ctx) => {
  const handle = value
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase()
  if (!handle) return null
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    ctx.addIssue({ code: 'custom', message: 'Informe um Instagram válido. Ex.: @seuestudio' })
    return z.NEVER
  }
  return handle
})

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.')
// Dias sem repetição e com abertura antes do fechamento. A lista vazia só é recusada
// onde ela é obrigatória (vitrine de serviços), por isso essa parte fica de fora.
const businessHoursDays = jsonArray(z.object({ day: z.number().int().min(0).max(6), open: time, close: time }), 7).superRefine(
  (days, ctx) => {
    if (new Set(days.map((entry) => entry.day)).size !== days.length) ctx.addIssue({ code: 'custom', message: 'Dia repetido.' })
    else if (days.some((entry) => entry.open >= entry.close)) {
      ctx.addIssue({ code: 'custom', message: 'O horário de abrir deve ser antes do de fechar.' })
    }
  },
)
export const businessHours = businessHoursDays.superRefine((days, ctx) => {
  if (days.length === 0) ctx.addIssue({ code: 'custom', message: 'Marque pelo menos um dia de atendimento.' })
})

/*
 * O assistente cria dois tipos de vitrine. Segmento do negócio e horários de
 * atendimento são do fluxo de serviços; a vitrine de produtos não os pergunta e
 * guarda nulo nos dois.
 */
export const createVitrineSchema = z
  .object({
    type: z.enum(WIZARD_VITRINE_TYPES, 'Escolha o tipo da vitrine.'),
    serviceSegment: z.string().trim(),
    name: vitrineName,
    subdomain: subdomainField,
    whatsappLabel: contactLabel,
    whatsappPhone: phone,
    instagram,
    address: optionalText(200),
    businessHours: businessHoursDays,
    theme,
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'servicos') return
    if (!isServiceSegment(data.serviceSegment)) {
      ctx.addIssue({ code: 'custom', path: ['serviceSegment'], message: 'Escolha o tipo do seu negócio.' })
    }
    if (data.businessHours.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['businessHours'], message: 'Marque pelo menos um dia de atendimento.' })
    }
  })
  .transform((data) => ({
    ...data,
    serviceSegment: isServiceSegment(data.serviceSegment) ? data.serviceSegment : null,
    businessHours: data.type === 'servicos' ? data.businessHours : null,
  }))

export const vitrineSettingsSchema = z.object({
  name: vitrineName,
  description: z.string().trim().max(300, 'Use até 300 caracteres.'),
  subdomain: subdomainField,
})

export const appearanceSchema = z.object({
  theme,
  showPrices: checkbox,
  showMedia: checkbox,
  brandColor: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value || null)
    .refine((value) => value === null || /^#[0-9a-f]{6}$/.test(value), 'Cor inválida.'),
  bannerEnabled: checkbox,
})

export const contactSchema = z.object({ label: contactLabel, phone })

export const categoryNameSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(40, 'Use até 40 caracteres.'),
})

const money = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null
    const cents = parseBRLToCents(value)
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido. Ex.: 49,90' })
      return z.NEVER
    }
    return cents
  })

const variationInput = z.object({
  id: z.uuid().nullish().transform((value) => value ?? null),
  name: z.string().trim().min(1, 'Informe o nome da variação.').max(40, 'Use até 40 caracteres.'),
  price: money,
  promoPrice: money,
  soldOut: z.boolean().default(false),
})

function jsonArray<T extends z.ZodType>(schema: T, max: number) {
  return z.string().transform((value, ctx) => {
    let raw: unknown
    try {
      raw = JSON.parse(value || '[]')
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Dados inválidos. Recarregue a página.' })
      return z.NEVER
    }
    const parsed = z.array(schema).max(max, `No máximo ${max}.`).safeParse(raw)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
      return z.NEVER
    }
    return parsed.data as z.output<T>[]
  })
}

export const itemSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do item.').max(80, 'Use até 80 caracteres.'),
    description: z.string().trim().max(1000, 'Use até 1000 caracteres.'),
    categoryId: z.uuid('Escolha a categoria.'),
    code: z.string().transform((value, ctx) => {
      if (!value.trim()) return null
      const result = validateItemCode(value)
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: ITEM_CODE_MESSAGES[result.reason] })
        return z.NEVER
      }
      return result.value
    }),
    priceType: z.enum(['fixed', 'from', 'on_request'], 'Escolha o tipo de preço.'),
    price: money,
    promoPrice: money,
    durationMinutes: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null
        const minutes = Number(value)
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
          ctx.addIssue({ code: 'custom', message: 'Informe a duração em minutos (1 a 1440).' })
          return z.NEVER
        }
        return minutes
      }),
    tags: z.string().transform((value, ctx) => {
      const tags = [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
      if (tags.length > 5 || tags.some((tag) => tag.length > 20)) {
        ctx.addIssue({ code: 'custom', message: 'Até 5 etiquetas com até 20 caracteres cada.' })
        return z.NEVER
      }
      return tags
    }),
    soldOut: checkbox,
    // Forma de venda (só as vitrines com sacola usam): pedido pelo WhatsApp ou link externo.
    saleMode: z.enum(['whatsapp', 'link']).default('whatsapp'),
    externalUrl: z
      .string()
      .trim()
      .max(500, 'Use até 500 caracteres.')
      .transform((value) => value || null)
      .refine(
        (value) => value === null || /^https:\/\/[^\s]+\.[^\s]+$/.test(value),
        'Informe o link completo, começando com https://',
      )
      .default(null),
    whatsappId: z.union([z.uuid(), z.literal('')]).transform((value) => value || null),
    buttonText: optionalText(30),
    customMessage: optionalText(500),
    notice: optionalText(300),
    variations: jsonArray(variationInput, 20),
    coverMediaId: z.uuid('Envie a imagem de capa.'),
    galleryMediaIds: jsonArray(z.uuid(), 2),
    videoMediaId: z
      .union([z.uuid(), z.literal('')])
      .default('')
      .transform((value) => value || null),
  })
  .superRefine((data, ctx) => {
    if (data.saleMode === 'link' && data.externalUrl === null) {
      ctx.addIssue({ code: 'custom', path: ['externalUrl'], message: 'Informe o link do produto.' })
    }
    if (data.priceType === 'on_request') return
    if (data.variations.length === 0 && data.price === null) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Informe o preço.' })
    }
    if (data.promoPrice !== null && (data.price === null || data.promoPrice >= data.price)) {
      ctx.addIssue({ code: 'custom', path: ['promoPrice'], message: 'O preço promocional deve ser menor que o preço.' })
    }
    data.variations.forEach((variation, index) => {
      if (variation.price === null) {
        ctx.addIssue({ code: 'custom', path: ['variations'], message: `Informe o preço da variação ${index + 1}.` })
      } else if (variation.promoPrice !== null && variation.promoPrice >= variation.price) {
        ctx.addIssue({
          code: 'custom',
          path: ['variations'],
          message: `O preço promocional da variação ${index + 1} deve ser menor que o preço.`,
        })
      }
    })
  })
  .transform((data) => {
    const onRequest = data.priceType === 'on_request'
    return {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      code: data.code,
      priceType: data.priceType,
      priceCents: onRequest ? null : data.price,
      promoPriceCents: onRequest ? null : data.promoPrice,
      durationMinutes: data.durationMinutes,
      tags: data.tags,
      soldOut: data.soldOut,
      // Sem link externo, o produto vende pelo WhatsApp e não guarda endereço nenhum.
      saleMode: data.saleMode,
      externalUrl: data.saleMode === 'link' ? data.externalUrl : null,
      whatsappId: data.whatsappId,
      buttonText: data.buttonText,
      customMessage: data.customMessage,
      notice: data.notice,
      // Em "sob consulta" as variações servem só para escolha; o preço guardado é ignorado no cálculo.
      variations: data.variations.map((variation) => ({
        id: variation.id,
        name: variation.name,
        priceCents: variation.price ?? 0,
        promoPriceCents: variation.promoPrice,
        soldOut: variation.soldOut,
      })),
      coverMediaId: data.coverMediaId,
      galleryMediaIds: data.galleryMediaIds,
      videoMediaId: data.videoMediaId,
    }
  })

export type ItemInput = z.output<typeof itemSchema>

export const checkoutSettingsSchema = z
  .object({
    cartEnabled: checkbox,
    cartButtonText: z.string().trim().min(1, 'Informe o texto do botão da sacola.').max(30, 'Use até 30 caracteres.'),
    defaultButtonText: z.string().trim().min(1, 'Informe o texto do botão.').max(30, 'Use até 30 caracteres.'),
    nameMode: fieldMode,
    phoneMode: fieldMode,
    fulfillmentMode: fieldMode,
    allowPickup: checkbox,
    allowDelivery: checkbox,
    extraNote: optionalText(300),
    paymentMode: fieldMode,
    scheduleMode: fieldMode,
    notesMode: fieldMode,
    paymentOptions: z.string().transform((value, ctx) => {
      const options = [...new Set(value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean))]
      if (options.length > 10 || options.some((option) => option.length > 30)) {
        ctx.addIssue({ code: 'custom', message: 'Até 10 formas de pagamento, com até 30 caracteres cada.' })
        return z.NEVER
      }
      return options
    }),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMode !== 'off' && data.paymentOptions.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['paymentOptions'], message: 'Informe pelo menos uma forma de pagamento.' })
    }
    if (data.fulfillmentMode !== 'off' && !data.allowPickup && !data.allowDelivery) {
      ctx.addIssue({ code: 'custom', path: ['allowPickup'], message: 'Marque pelo menos retirada ou entrega.' })
    }
  })

// Agenda (vitrines de serviços): regras de disponibilidade e bloqueios avulsos.

const option = <T extends readonly number[]>(values: T, message: string) =>
  z.string().transform((value, ctx) => {
    const number = Number(value)
    if (!value || !values.includes(number)) {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }
    return number
  })

export const bookingRulesSchema = z.object({
  businessHours,
  bufferMinutes: option(BUFFER_OPTIONS, 'Escolha o intervalo.'),
  minNoticeMinutes: option(MIN_NOTICE_OPTIONS, 'Escolha a antecedência.'),
  maxDaysAhead: option(MAX_DAYS_OPTIONS, 'Escolha até quando dá para agendar.'),
})

export const bookingBlockSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
    allDay: checkbox,
    start: z.string(),
    end: z.string(),
    reason: optionalText(80),
  })
  .superRefine((data, ctx) => {
    if (data.allDay) return
    if (!time.safeParse(data.start).success) ctx.addIssue({ code: 'custom', path: ['start'], message: 'Informe o início.' })
    else if (!time.safeParse(data.end).success) ctx.addIssue({ code: 'custom', path: ['end'], message: 'Informe o fim.' })
    else if (data.start >= data.end) ctx.addIssue({ code: 'custom', path: ['end'], message: 'O fim deve ser depois do início.' })
  })

export const appointmentRescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário.'),
})

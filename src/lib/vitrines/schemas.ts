import { z } from 'zod'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { validateSubdomain } from '@/lib/hosts/subdomain'
import { parseBRLToCents } from '@/lib/money/money'
import { normalizePhone } from '@/lib/whatsapp/phone'
import { WIZARD_VITRINE_TYPES } from './vitrine-types'

const SUBDOMAIN_MESSAGES = {
  length: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  format: 'Use de 3 a 30 caracteres: letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
  reserved: 'Este endereço é reservado. Escolha outro.',
} as const

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

export const createVitrineSchema = z.object({
  type: z.enum(WIZARD_VITRINE_TYPES, 'Escolha o tipo da vitrine.'),
  name: vitrineName,
  subdomain: subdomainField,
  whatsappLabel: contactLabel,
  whatsappPhone: phone,
  theme,
})

export const vitrineSettingsSchema = z.object({
  name: vitrineName,
  description: z.string().trim().max(300, 'Use até 300 caracteres.'),
  subdomain: subdomainField,
})

export const messagesSchema = z.object({
  defaultButtonText: z.string().trim().min(1, 'Informe o texto do botão.').max(30, 'Use até 30 caracteres.'),
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
    whatsappId: z.union([z.uuid(), z.literal('')]).transform((value) => value || null),
    buttonText: optionalText(30),
    customMessage: optionalText(500),
    variations: jsonArray(variationInput, 20),
    coverMediaId: z.uuid('Envie a imagem de capa.'),
    galleryMediaIds: jsonArray(z.uuid(), 2),
    videoMediaId: z
      .union([z.uuid(), z.literal('')])
      .default('')
      .transform((value) => value || null),
  })
  .superRefine((data, ctx) => {
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
      whatsappId: data.whatsappId,
      buttonText: data.buttonText,
      customMessage: data.customMessage,
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

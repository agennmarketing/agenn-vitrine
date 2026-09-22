import { z } from 'zod'

type Source = Record<string, string | undefined>

const mediaStorageSchema = z
  .object({
    MEDIA_STORAGE_DRIVER: z.enum(['bunny', 'fake']).default('bunny'),
    BUNNY_STORAGE_ZONE: z.string().default(''),
    BUNNY_STORAGE_PASSWORD: z.string().default(''),
    BUNNY_STORAGE_HOST: z.string().default('br.storage.bunnycdn.com'),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MEDIA_STORAGE_DRIVER === 'bunny' && (!value.BUNNY_STORAGE_ZONE || !value.BUNNY_STORAGE_PASSWORD)) {
      ctx.addIssue({ code: 'custom', message: 'BUNNY_STORAGE_ZONE e BUNNY_STORAGE_PASSWORD são obrigatórias com o driver bunny.' })
    }
    if (value.MEDIA_STORAGE_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'MEDIA_STORAGE_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type MediaStorageEnv = { driver: 'fake' } | { driver: 'bunny'; zone: string; password: string; host: string }

export function parseMediaStorageEnv(source: Source): MediaStorageEnv {
  const value = mediaStorageSchema.parse(source)
  if (value.MEDIA_STORAGE_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'bunny', zone: value.BUNNY_STORAGE_ZONE, password: value.BUNNY_STORAGE_PASSWORD, host: value.BUNNY_STORAGE_HOST }
}

export function parseRateLimitSalt(source: Source): string {
  return z.string().min(16, 'RATE_LIMIT_SALT precisa de pelo menos 16 caracteres.').parse(source.RATE_LIMIT_SALT)
}

export function parseSupabaseSecretKey(source: Source): string {
  return z.string().min(1, 'SUPABASE_SECRET_KEY não configurada.').parse(source.SUPABASE_SECRET_KEY)
}

export function parseOrderRateLimit(source: Source): number {
  return z.coerce.number().int().min(1).default(20).parse(source.ORDER_RATE_LIMIT_PER_HOUR ?? undefined)
}

const videoServiceSchema = z
  .object({
    VIDEO_DRIVER: z.enum(['mux', 'fake']).default('mux'),
    MUX_TOKEN_ID: z.string().default(''),
    MUX_TOKEN_SECRET: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.VIDEO_DRIVER === 'mux' && (!value.MUX_TOKEN_ID || !value.MUX_TOKEN_SECRET)) {
      ctx.addIssue({ code: 'custom', message: 'MUX_TOKEN_ID e MUX_TOKEN_SECRET são obrigatórias com o driver mux.' })
    }
    if (value.VIDEO_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'VIDEO_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type VideoServiceEnv = { driver: 'fake' } | { driver: 'mux'; tokenId: string; tokenSecret: string }

export function parseVideoServiceEnv(source: Source): VideoServiceEnv {
  const value = videoServiceSchema.parse(source)
  if (value.VIDEO_DRIVER === 'fake') return { driver: 'fake' }
  return { driver: 'mux', tokenId: value.MUX_TOKEN_ID, tokenSecret: value.MUX_TOKEN_SECRET }
}

export function parseWebhookSecret(source: Source): string {
  return z.string().min(8, 'MUX_WEBHOOK_SECRET não configurada.').parse(source.MUX_WEBHOOK_SECRET)
}

export function parseCronSecret(source: Source): string {
  return z.string().min(16, 'CRON_SECRET precisa de pelo menos 16 caracteres.').parse(source.CRON_SECRET)
}

const emailSchema = z
  .object({
    EMAIL_DRIVER: z.enum(['off', 'fake', 'resend']).default('off'),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_DRIVER === 'resend' && (!value.RESEND_API_KEY || !value.EMAIL_FROM)) {
      ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY e EMAIL_FROM são obrigatórias com EMAIL_DRIVER=resend.' })
    }
    if (value.EMAIL_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'EMAIL_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type EmailEnv = { driver: 'off' } | { driver: 'fake' } | { driver: 'resend'; apiKey: string; from: string }

export function parseEmailEnv(source: Source): EmailEnv {
  const value = emailSchema.parse(source)
  if (value.EMAIL_DRIVER === 'resend') return { driver: 'resend', apiKey: value.RESEND_API_KEY, from: value.EMAIL_FROM }
  return { driver: value.EMAIL_DRIVER }
}

const billingSchema = z
  .object({
    BILLING_DRIVER: z.enum(['stripe', 'fake']).default('stripe'),
    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    STRIPE_PRICE_MONTH: z.string().default(''),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.BILLING_DRIVER === 'stripe' &&
      (!value.STRIPE_SECRET_KEY || !value.STRIPE_PRICE_MONTH)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'STRIPE_SECRET_KEY e STRIPE_PRICE_MONTH são obrigatórias com o driver stripe.',
      })
    }
    // Os dois drivers conferem a assinatura do webhook com o SDK do Stripe.
    if (value.STRIPE_WEBHOOK_SECRET.length < 8) {
      ctx.addIssue({ code: 'custom', message: 'STRIPE_WEBHOOK_SECRET não configurada.' })
    }
    if (value.BILLING_DRIVER === 'fake' && value.VERCEL_ENV === 'production') {
      ctx.addIssue({ code: 'custom', message: 'BILLING_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type BillingEnv = {
  driver: 'stripe' | 'fake'
  secretKey: string
  webhookSecret: string
  priceMonth: string
}

export function parseBillingEnv(source: Source): BillingEnv {
  const value = billingSchema.parse(source)
  return {
    driver: value.BILLING_DRIVER,
    secretKey: value.STRIPE_SECRET_KEY,
    webhookSecret: value.STRIPE_WEBHOOK_SECRET,
    priceMonth: value.STRIPE_PRICE_MONTH,
  }
}

import { z } from 'zod'

type Source = Record<string, string | undefined>

/*
 * Em produção nenhum driver falso é aceito. A Vercel informa isso em VERCEL_ENV;
 * em qualquer outra hospedagem (Netlify, por exemplo) vale APP_ENV, que a gente
 * define nas variáveis do ambiente.
 */
const inProduction = (value: { APP_ENV?: string; VERCEL_ENV?: string }) =>
  (value.APP_ENV ?? value.VERCEL_ENV) === 'production'

const mediaStorageSchema = z
  .object({
    // "bunny" era o driver antigo: quem ainda tem a variável assim passa a gravar no Supabase.
    MEDIA_STORAGE_DRIVER: z.preprocess((value) => (value === 'bunny' ? 'supabase' : value), z.enum(['supabase', 'fake']).default('supabase')),
    APP_ENV: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MEDIA_STORAGE_DRIVER === 'fake' && inProduction(value)) {
      ctx.addIssue({ code: 'custom', message: 'MEDIA_STORAGE_DRIVER=fake não pode ser usado em produção.' })
    }
  })

export type MediaStorageEnv = { driver: 'fake' | 'supabase' }

export function parseMediaStorageEnv(source: Source): MediaStorageEnv {
  return { driver: mediaStorageSchema.parse(source).MEDIA_STORAGE_DRIVER }
}

// Variável ausente cai na mesma mensagem da vazia: o log diz qual falta.
export function parseRateLimitSalt(source: Source): string {
  return z.string().min(16, 'RATE_LIMIT_SALT precisa de pelo menos 16 caracteres.').parse(source.RATE_LIMIT_SALT ?? '')
}

export function parseSupabaseSecretKey(source: Source): string {
  return z.string().min(1, 'SUPABASE_SECRET_KEY não configurada.').parse(source.SUPABASE_SECRET_KEY ?? '')
}

export function parseOrderRateLimit(source: Source): number {
  return z.coerce.number().int().min(1).default(20).parse(source.ORDER_RATE_LIMIT_PER_HOUR ?? undefined)
}

export function parseCronSecret(source: Source): string {
  return z.string().min(16, 'CRON_SECRET precisa de pelo menos 16 caracteres.').parse(source.CRON_SECRET ?? '')
}

const emailSchema = z
  .object({
    EMAIL_DRIVER: z.enum(['off', 'fake', 'resend']).default('off'),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default(''),
    APP_ENV: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_DRIVER === 'resend' && (!value.RESEND_API_KEY || !value.EMAIL_FROM)) {
      ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY e EMAIL_FROM são obrigatórias com EMAIL_DRIVER=resend.' })
    }
    if (value.EMAIL_DRIVER === 'fake' && inProduction(value)) {
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
    APP_ENV: z.string().optional(),
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
    if (value.BILLING_DRIVER === 'fake' && inProduction(value)) {
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

// Cadastro automático dos subdomínios das vitrines como alias na Netlify.
// Sem as duas variáveis (local, CI) a sincronização não roda; com só uma, é erro de configuração.
const netlifyDomainsSchema = z
  .object({
    NETLIFY_API_TOKEN: z.string().default(''),
    NETLIFY_SITE_ID: z.string().default(''),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.NETLIFY_API_TOKEN) !== Boolean(value.NETLIFY_SITE_ID)) {
      ctx.addIssue({ code: 'custom', message: 'NETLIFY_API_TOKEN e NETLIFY_SITE_ID vão juntas.' })
    }
  })

export type NetlifyDomainsEnv = { token: string; siteId: string } | null

export function parseNetlifyDomainsEnv(source: Source): NetlifyDomainsEnv {
  // Na Netlify o SITE_ID já vem preenchido: com o token, basta ele.
  const siteId = source.NETLIFY_SITE_ID || (source.NETLIFY_API_TOKEN ? source.SITE_ID : undefined)
  const value = netlifyDomainsSchema.parse({ ...source, NETLIFY_SITE_ID: siteId })
  if (!value.NETLIFY_API_TOKEN) return null
  return { token: value.NETLIFY_API_TOKEN, siteId: value.NETLIFY_SITE_ID }
}

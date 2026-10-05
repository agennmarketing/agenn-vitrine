import { describe, expect, it } from 'vitest'
import {
  parseBillingEnv,
  parseCronSecret,
  parseEmailEnv,
  parseMediaStorageEnv,
  parseNetlifyDomainsEnv,
  parseOrderRateLimit,
  parseRateLimitSalt,
} from './server-env-schema'

describe('parseMediaStorageEnv', () => {
  it('supabase é o padrão e o antigo bunny vira supabase', () => {
    expect(parseMediaStorageEnv({})).toEqual({ driver: 'supabase' })
    expect(parseMediaStorageEnv({ MEDIA_STORAGE_DRIVER: 'bunny' })).toEqual({ driver: 'supabase' })
  })

  it('fake só fora de produção', () => {
    expect(parseMediaStorageEnv({ MEDIA_STORAGE_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseMediaStorageEnv({ MEDIA_STORAGE_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})

it('parseRateLimitSalt exige 16 caracteres', () => {
  expect(() => parseRateLimitSalt({ RATE_LIMIT_SALT: 'curto' })).toThrow()
  expect(parseRateLimitSalt({ RATE_LIMIT_SALT: 'ci-salt-somente-para-testes' })).toBe('ci-salt-somente-para-testes')
})

it('limite de pedidos por hora', () => {
  expect(parseOrderRateLimit({})).toBe(20)
  expect(parseOrderRateLimit({ ORDER_RATE_LIMIT_PER_HOUR: '1000' })).toBe(1000)
})

it('segredo do cron', () => {
  expect(() => parseCronSecret({ CRON_SECRET: 'curto' })).toThrow()
  expect(parseCronSecret({ CRON_SECRET: 'ci-cron-secret-somente-para-testes' })).toBe('ci-cron-secret-somente-para-testes')
})

describe('parseEmailEnv', () => {
  it('desligado por padrão', () => {
    expect(parseEmailEnv({})).toEqual({ driver: 'off' })
  })

  it('resend exige chave e remetente', () => {
    expect(() => parseEmailEnv({ EMAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/)
    expect(
      parseEmailEnv({ EMAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Agenn Vitrine <nao-responda@agenn.com.br>' }),
    ).toEqual({ driver: 'resend', apiKey: 're_x', from: 'Agenn Vitrine <nao-responda@agenn.com.br>' })
  })

  it('fake só fora de produção', () => {
    expect(parseEmailEnv({ EMAIL_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseEmailEnv({ EMAIL_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})

describe('parseBillingEnv', () => {
  const stripeEnv = {
    BILLING_DRIVER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123456789',
    STRIPE_PRICE_MONTH: 'price_mes',
  }

  it('lê a configuração do Stripe', () => {
    expect(parseBillingEnv(stripeEnv)).toEqual({
      driver: 'stripe',
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123456789',
      priceMonth: 'price_mes',
    })
  })

  it('exige chave e preços com o driver stripe', () => {
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_PRICE_MONTH: '' })).toThrow()
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_SECRET_KEY: '' })).toThrow()
  })

  it('exige o segredo do webhook nos dois drivers', () => {
    expect(() => parseBillingEnv({ ...stripeEnv, STRIPE_WEBHOOK_SECRET: 'curto' })).toThrow()
    expect(() => parseBillingEnv({ BILLING_DRIVER: 'fake' })).toThrow()
  })

  it('aceita o driver falso fora de produção e recusa na Vercel', () => {
    expect(parseBillingEnv({ BILLING_DRIVER: 'fake', STRIPE_WEBHOOK_SECRET: 'whsec_de_teste' }).driver).toBe('fake')
    expect(() =>
      parseBillingEnv({ BILLING_DRIVER: 'fake', STRIPE_WEBHOOK_SECRET: 'whsec_de_teste', VERCEL_ENV: 'production' }),
    ).toThrow()
  })
})

describe('parseNetlifyDomainsEnv', () => {
  it('sem as variáveis a sincronização fica desligada', () => {
    expect(parseNetlifyDomainsEnv({})).toBeNull()
  })

  it('token e site vão juntos', () => {
    expect(parseNetlifyDomainsEnv({ NETLIFY_API_TOKEN: 't', NETLIFY_SITE_ID: 's' })).toEqual({ token: 't', siteId: 's' })
    expect(() => parseNetlifyDomainsEnv({ NETLIFY_API_TOKEN: 't' })).toThrow(/juntas/)
    expect(() => parseNetlifyDomainsEnv({ NETLIFY_SITE_ID: 's' })).toThrow(/juntas/)
  })
})

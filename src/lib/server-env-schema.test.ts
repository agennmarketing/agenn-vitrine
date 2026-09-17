import { describe, expect, it } from 'vitest'
import { parseCronSecret, parseMediaStorageEnv, parseOrderRateLimit, parseRateLimitSalt, parseVideoStreamEnv, parseWebhookSecret } from './server-env-schema'

describe('parseMediaStorageEnv', () => {
  it('bunny é o padrão e exige zona e senha', () => {
    expect(() => parseMediaStorageEnv({})).toThrow(/BUNNY_STORAGE_ZONE/)
    expect(parseMediaStorageEnv({ BUNNY_STORAGE_ZONE: 'z', BUNNY_STORAGE_PASSWORD: 'p' })).toEqual({
      driver: 'bunny',
      zone: 'z',
      password: 'p',
      host: 'br.storage.bunnycdn.com',
    })
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

describe('parseVideoStreamEnv', () => {
  it('bunny exige biblioteca e chave', () => {
    expect(() => parseVideoStreamEnv({})).toThrow(/BUNNY_STREAM_LIBRARY_ID/)
    expect(parseVideoStreamEnv({ BUNNY_STREAM_LIBRARY_ID: '123', BUNNY_STREAM_API_KEY: 'k' })).toEqual({
      driver: 'bunny',
      libraryId: '123',
      apiKey: 'k',
    })
  })

  it('fake só fora de produção', () => {
    expect(parseVideoStreamEnv({ VIDEO_STREAM_DRIVER: 'fake' })).toEqual({ driver: 'fake' })
    expect(() => parseVideoStreamEnv({ VIDEO_STREAM_DRIVER: 'fake', VERCEL_ENV: 'production' })).toThrow(/produção/)
  })
})

it('segredos do webhook e do cron', () => {
  expect(() => parseWebhookSecret({})).toThrow()
  expect(parseWebhookSecret({ BUNNY_STREAM_WEBHOOK_SECRET: 'ci-webhook-secret' })).toBe('ci-webhook-secret')
  expect(() => parseCronSecret({ CRON_SECRET: 'curto' })).toThrow()
  expect(parseCronSecret({ CRON_SECRET: 'ci-cron-secret-somente-para-testes' })).toBe('ci-cron-secret-somente-para-testes')
})

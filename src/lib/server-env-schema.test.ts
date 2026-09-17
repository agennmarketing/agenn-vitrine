import { describe, expect, it } from 'vitest'
import { parseMediaStorageEnv, parseRateLimitSalt } from './server-env-schema'

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

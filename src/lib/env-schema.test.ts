import { describe, expect, it } from 'vitest'
import { parseEnv } from './env-schema'

const base = {
  NEXT_PUBLIC_ROOT_DOMAIN: 'agenn.com.br',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
}

describe('parseEnv', () => {
  it('aplica padrões para variáveis opcionais', () => {
    const env = parseEnv(base)
    expect(env.LEGACY_DOMAINS).toEqual([])
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('')
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false)
  })

  it('separa, limpa e normaliza domínios antigos', () => {
    const env = parseEnv({ ...base, LEGACY_DOMAINS: ' Agenn.com.br , ,old.com ' })
    expect(env.LEGACY_DOMAINS).toEqual(['agenn.com.br', 'old.com'])
  })

  it('normaliza o domínio raiz para minúsculas', () => {
    expect(parseEnv({ ...base, NEXT_PUBLIC_ROOT_DOMAIN: 'Agenn.com.br' }).NEXT_PUBLIC_ROOT_DOMAIN).toBe('agenn.com.br')
  })

  it('liga o Google só com "true"', () => {
    expect(parseEnv({ ...base, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true' }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(true)
    expect(parseEnv({ ...base, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'yes' }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false)
  })

  it('URL base das mídias: vazia por padrão e sem barra final', () => {
    expect(parseEnv(base).NEXT_PUBLIC_MEDIA_BASE_URL).toBe('')
    expect(parseEnv({ ...base, NEXT_PUBLIC_MEDIA_BASE_URL: 'https://cdn.exemplo.com/' }).NEXT_PUBLIC_MEDIA_BASE_URL).toBe('https://cdn.exemplo.com')
  })

  it('falha sem domínio raiz', () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_ROOT_DOMAIN: undefined })).toThrow()
  })
})

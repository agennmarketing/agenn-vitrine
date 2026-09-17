import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { hasPasswordLogin, isRecentEmailLinkSession, isSessionCurrent, isSessionGoneError } from './session'

describe('isSessionCurrent', () => {
  it('sem sessão ativa registrada, aceita', () => {
    expect(isSessionCurrent('s1', null)).toBe(true)
  })
  it('aceita só a sessão registrada', () => {
    expect(isSessionCurrent('s1', 's1')).toBe(true)
    expect(isSessionCurrent('s2', 's1')).toBe(false)
    expect(isSessionCurrent(undefined, 's1')).toBe(false)
  })
})

describe('hasPasswordLogin', () => {
  it('true só com identidade email', () => {
    expect(hasPasswordLogin([{ provider: 'email' }])).toBe(true)
    expect(hasPasswordLogin([{ provider: 'google' }])).toBe(false)
    expect(hasPasswordLogin([{ provider: 'google' }, { provider: 'email' }])).toBe(true)
    expect(hasPasswordLogin(undefined)).toBe(false)
  })
})

describe('isRecentEmailLinkSession', () => {
  const now = 1_800_000_000

  it('false para sessões de senha ou Google', () => {
    expect(isRecentEmailLinkSession([{ method: 'password', timestamp: now - 10 }], now)).toBe(false)
    expect(isRecentEmailLinkSession([{ method: 'oauth', timestamp: now - 10 }], now)).toBe(false)
  })

  it('true para link de e-mail (otp, recovery, magiclink) nos últimos 15 minutos', () => {
    expect(isRecentEmailLinkSession([{ method: 'otp', timestamp: now - 60 }], now)).toBe(true)
    expect(isRecentEmailLinkSession([{ method: 'recovery', timestamp: now - 15 * 60 }], now)).toBe(true)
    expect(isRecentEmailLinkSession([{ method: 'password', timestamp: now - 5 }, { method: 'magiclink', timestamp: now - 5 }], now)).toBe(true)
  })

  it('false quando o link é antigo', () => {
    expect(isRecentEmailLinkSession([{ method: 'otp', timestamp: now - 15 * 60 - 1 }], now)).toBe(false)
  })

  it('false para formatos inválidos', () => {
    expect(isRecentEmailLinkSession(undefined, now)).toBe(false)
    expect(isRecentEmailLinkSession(null, now)).toBe(false)
    expect(isRecentEmailLinkSession('otp', now)).toBe(false)
    expect(isRecentEmailLinkSession({ method: 'otp', timestamp: now }, now)).toBe(false)
    expect(isRecentEmailLinkSession([null, 1, { method: 'otp' }, { method: 'otp', timestamp: 'x' }], now)).toBe(false)
    expect(isRecentEmailLinkSession(['otp', 'recovery'], now)).toBe(false)
  })
})

describe('isSessionGoneError', () => {
  it('true para sessão revogada ou JWT inválido', () => {
    expect(isSessionGoneError(new AuthApiError('x', 403, 'session_not_found'))).toBe(true)
    expect(isSessionGoneError(new AuthApiError('x', 401, undefined))).toBe(true)
    expect(isSessionGoneError(new AuthApiError('x', 400, 'bad_jwt'))).toBe(true)
  })

  it('false para falhas de rede, 5xx ou ausência de erro', () => {
    expect(isSessionGoneError(null)).toBe(false)
    expect(isSessionGoneError(new AuthRetryableFetchError('fetch failed', 0))).toBe(false)
    expect(isSessionGoneError(new AuthApiError('x', 500, 'unexpected_failure'))).toBe(false)
    expect(isSessionGoneError(new AuthSessionMissingError())).toBe(false)
    expect(isSessionGoneError(new Error('x'))).toBe(false)
  })
})

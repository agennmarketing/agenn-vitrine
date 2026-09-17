import { describe, expect, it } from 'vitest'
import { hasPasswordLogin, isRecentEmailLinkSession } from './session'

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

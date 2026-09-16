import { describe, expect, it } from 'vitest'
import { hasPasswordLogin, isSessionCurrent } from './session'

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

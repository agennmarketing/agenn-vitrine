import { describe, expect, it } from 'vitest'
import { interpretSessionState } from './session-state'

describe('interpretSessionState', () => {
  it('current: autenticado e sessão atual', () => {
    expect(interpretSessionState({ data: 'current', status: 200, hasError: false })).toEqual({
      isAuthenticated: true,
      isSessionCurrent: true,
      clearCookies: false,
    })
  })

  it('replaced: autenticado, sessão substituída (o proxy encerra com a mensagem)', () => {
    expect(interpretSessionState({ data: 'replaced', status: 200, hasError: false })).toEqual({
      isAuthenticated: true,
      isSessionCurrent: false,
      clearCookies: false,
    })
  })

  it('revoked e anonymous: não autenticado e limpa cookies', () => {
    for (const data of ['revoked', 'anonymous', 'qualquer']) {
      expect(interpretSessionState({ data, status: 200, hasError: false })).toEqual({
        isAuthenticated: false,
        isSessionCurrent: true,
        clearCookies: true,
      })
    }
  })

  it('401: JWT recusado, limpa cookies', () => {
    expect(interpretSessionState({ data: null, status: 401, hasError: true })).toEqual({
      isAuthenticated: false,
      isSessionCurrent: true,
      clearCookies: true,
    })
  })

  it('falha de rede, 5xx ou 403: não autenticado, mas mantém os cookies', () => {
    for (const status of [0, 403, 500, 503]) {
      expect(interpretSessionState({ data: null, status, hasError: true })).toEqual({
        isAuthenticated: false,
        isSessionCurrent: true,
        clearCookies: false,
      })
    }
  })
})

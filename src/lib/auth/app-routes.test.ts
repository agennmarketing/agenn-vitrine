import { describe, expect, it } from 'vitest'
import { decideAppRoute } from './app-routes'

const guest = { isAuthenticated: false, isSessionCurrent: true }
const user = { isAuthenticated: true, isSessionCurrent: true }

describe('decideAppRoute', () => {
  it('raiz leva ao painel ou ao login', () => {
    expect(decideAppRoute({ pathname: '/', ...guest })).toEqual({ action: 'redirect', to: '/entrar' })
    expect(decideAppRoute({ pathname: '/', ...user })).toEqual({ action: 'redirect', to: '/painel' })
  })

  it('visitante em rota protegida vai para o login guardando o destino', () => {
    expect(decideAppRoute({ pathname: '/painel/conta', ...guest })).toEqual({
      action: 'redirect',
      to: '/entrar?next=%2Fpainel%2Fconta',
    })
    expect(decideAppRoute({ pathname: '/redefinir-senha', ...guest })).toEqual({
      action: 'redirect',
      to: '/entrar?next=%2Fredefinir-senha',
    })
  })

  it('visitante acessa as rotas públicas', () => {
    for (const pathname of [
      '/entrar',
      '/cadastro',
      '/confirmar-email',
      '/esqueci-senha',
      '/auth/callback',
      '/auth/confirm',
      '/robots.txt',
      // O navegador pede o manifesto do aplicativo sem cookie, logado ou não.
      '/pwa/manifest.webmanifest',
      '/termos',
      '/privacidade',
    ]) {
      expect(decideAppRoute({ pathname, ...guest })).toEqual({ action: 'continue' })
    }
  })

  it('usuário logado não vê telas de visitante', () => {
    for (const pathname of ['/entrar', '/cadastro', '/esqueci-senha']) {
      expect(decideAppRoute({ pathname, ...user })).toEqual({ action: 'redirect', to: '/painel' })
    }
    expect(decideAppRoute({ pathname: '/painel', ...user })).toEqual({ action: 'continue' })
    expect(decideAppRoute({ pathname: '/redefinir-senha', ...user })).toEqual({ action: 'continue' })
  })

  it('sessão substituída é encerrada em qualquer rota', () => {
    expect(decideAppRoute({ pathname: '/painel', isAuthenticated: true, isSessionCurrent: false })).toEqual({
      action: 'end-session',
      to: '/entrar?motivo=outro-aparelho',
    })
  })

  it('rotas /auth/* seguem mesmo com sessão substituída (elas trocam a sessão)', () => {
    for (const pathname of ['/auth/callback', '/auth/confirm']) {
      expect(decideAppRoute({ pathname, isAuthenticated: true, isSessionCurrent: false })).toEqual({ action: 'continue' })
    }
    expect(decideAppRoute({ pathname: '/auth/callbackx', isAuthenticated: true, isSessionCurrent: false })).toEqual({
      action: 'end-session',
      to: '/entrar?motivo=outro-aparelho',
    })
  })

  it('não confunde prefixos parecidos', () => {
    expect(decideAppRoute({ pathname: '/entrarx', ...guest })).toEqual({ action: 'redirect', to: '/entrar?next=%2Fentrarx' })
  })
})

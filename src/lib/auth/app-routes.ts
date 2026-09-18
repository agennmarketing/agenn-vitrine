export const PUBLIC_APP_PATHS = [
  '/entrar',
  '/cadastro',
  '/confirmar-email',
  '/esqueci-senha',
  '/auth/callback',
  '/auth/confirm',
  // Buscadores acessam sem cookie: precisa responder sem cair no login.
  '/robots.txt',
  // Precisam abrir sem sessão: o link vai para quem ainda está criando a conta.
  '/termos',
  '/privacidade',
] as const

// Estas rotas trocam a sessão do cookie pela nova (link de e-mail, Google): não
// encerram a sessão antiga antes, senão o fluxo seria interrompido.
const SESSION_REPLACING_PATHS: readonly string[] = ['/auth/callback', '/auth/confirm']

const GUEST_ONLY_PATHS: readonly string[] = ['/entrar', '/cadastro', '/esqueci-senha']

export type AppRouteDecision =
  | { action: 'continue' }
  | { action: 'redirect'; to: string }
  | { action: 'end-session'; to: string }

function matches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function decideAppRoute(input: {
  pathname: string
  isAuthenticated: boolean
  isSessionCurrent: boolean
}): AppRouteDecision {
  const { pathname, isAuthenticated, isSessionCurrent } = input

  if (isAuthenticated && !isSessionCurrent && !SESSION_REPLACING_PATHS.some((path) => matches(pathname, path))) {
    return { action: 'end-session', to: '/entrar?motivo=outro-aparelho' }
  }
  if (pathname === '/') {
    return { action: 'redirect', to: isAuthenticated ? '/painel' : '/entrar' }
  }

  const isPublic = PUBLIC_APP_PATHS.some((path) => matches(pathname, path))
  if (!isAuthenticated && !isPublic) {
    return { action: 'redirect', to: `/entrar?next=${encodeURIComponent(pathname)}` }
  }
  if (isAuthenticated && GUEST_ONLY_PATHS.some((path) => matches(pathname, path))) {
    return { action: 'redirect', to: '/painel' }
  }
  return { action: 'continue' }
}

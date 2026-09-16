export const PUBLIC_APP_PATHS = [
  '/entrar',
  '/cadastro',
  '/confirmar-email',
  '/esqueci-senha',
  '/auth/callback',
  '/auth/confirm',
] as const

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

  if (isAuthenticated && !isSessionCurrent) {
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

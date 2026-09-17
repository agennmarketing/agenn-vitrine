import { isAuthError } from '@supabase/supabase-js'

export function isSessionCurrent(
  claimSessionId: string | null | undefined,
  activeSessionId: string | null | undefined,
): boolean {
  if (!activeSessionId) return true
  return claimSessionId === activeSessionId
}

export function hasPasswordLogin(identities: ReadonlyArray<{ provider: string }> | null | undefined): boolean {
  return Boolean(identities?.some((identity) => identity.provider === 'email'))
}

const EMAIL_LINK_METHODS: readonly string[] = ['otp', 'recovery', 'magiclink']

// Uma sessão só pode criar nova senha sem informar a atual se veio de um link de
// e-mail (recuperação) aberto há pouco. O claim `amr` do JWT do Supabase é uma lista
// de `{ method, timestamp }` — ex.: `[{ "method": "otp", "timestamp": 1789606631 }]`
// após `/auth/confirm?type=recovery` e `[{ "method": "password", ... }]` após login.
export function isRecentEmailLinkSession(amr: unknown, nowSec = Date.now() / 1000, maxAgeSec = 15 * 60): boolean {
  if (!Array.isArray(amr)) return false
  return amr.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown }
    return (
      typeof method === 'string' &&
      EMAIL_LINK_METHODS.includes(method) &&
      typeof timestamp === 'number' &&
      nowSec - timestamp <= maxAgeSec
    )
  })
}

// Erro do Auth que indica que a sessão do cookie não existe mais (revogada, JWT
// inválido). Falhas de rede e 5xx não contam: nesses casos os cookies são mantidos.
export function isSessionGoneError(error: unknown): boolean {
  if (!isAuthError(error)) return false
  if (error.code === 'session_not_found' || error.code === 'bad_jwt') return true
  return error.status === 401 || error.status === 403
}

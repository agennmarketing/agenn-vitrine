export type SessionStateResult = {
  isAuthenticated: boolean
  isSessionCurrent: boolean
  clearCookies: boolean
}

// Traduz a resposta de `rpc('session_state')`. Falha de rede/5xx é fail-closed
// (não autenticado) sem apagar cookies, para não deslogar por instabilidade.
// 403 também não apaga: indica grant faltando (erro de deploy), não sessão ruim.
export function interpretSessionState(input: { data: unknown; status: number; hasError: boolean }): SessionStateResult {
  if (!input.hasError) {
    if (input.data === 'current') return { isAuthenticated: true, isSessionCurrent: true, clearCookies: false }
    if (input.data === 'replaced') return { isAuthenticated: true, isSessionCurrent: false, clearCookies: false }
    return { isAuthenticated: false, isSessionCurrent: true, clearCookies: true }
  }
  return { isAuthenticated: false, isSessionCurrent: true, clearCookies: input.status === 401 }
}

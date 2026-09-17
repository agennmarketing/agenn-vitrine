// Registra a sessão atual como a única ativa da conta (sessão única). Tenta de novo
// uma vez; se ainda falhar, encerra a sessão local para não deixar o usuário entrar
// com uma sessão que o proxy trataria como "acessada em outro aparelho".
type ClaimSessionClient = {
  rpc: (fn: 'claim_session') => PromiseLike<{ error: unknown }>
  auth: { signOut: (options: { scope: 'local' }) => Promise<unknown> }
}

export async function claimSessionOrFail(supabase: ClaimSessionClient): Promise<boolean> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.rpc('claim_session')
    if (!error) return true
    lastError = error
  }
  console.error('[auth] falha ao registrar a sessão ativa (claim_session)', lastError)
  await supabase.auth.signOut({ scope: 'local' })
  return false
}

import 'server-only'
import { interpretSessionState } from '@/lib/auth/session-state'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Rotas em /api/ não passam pelo proxy: conferem sessão e sessão única aqui.
export async function getApiUser() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (typeof userId !== 'string') return null

  const { data: state, error, status } = await supabase.rpc('session_state')
  const result = interpretSessionState({ data: state, status, hasError: Boolean(error) })
  if (!result.isAuthenticated || !result.isSessionCurrent) return null
  return { supabase, userId }
}

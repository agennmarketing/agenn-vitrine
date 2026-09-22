import 'server-only'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Sem teste nem assinatura valendo, nada do painel grava: a ação leva à tela de
// assinatura. Só as ações de assinar e gerenciar a assinatura passam `allowBlocked`.
export async function requireActionUser({ allowBlocked = false }: { allowBlocked?: boolean } = {}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  if (!allowBlocked) {
    const { data: plan } = await supabase.rpc('my_entitlements')
    if (plan?.id !== 'essencial') redirect('/painel/plano')
  }
  return { supabase, user }
}

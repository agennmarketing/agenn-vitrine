import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { isRecentEmailLinkSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = { title: 'Criar nova senha' }

// O proxy exige sessão; aqui exigimos também que ela tenha vindo de um link de
// recuperação aberto há pouco. Qualquer outra sessão troca a senha em Conta,
// informando a senha atual.
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  if (!isRecentEmailLinkSession(data?.claims?.amr)) redirect('/painel/conta')

  return (
    <AuthShell title="Criar nova senha" description="Escolha uma nova senha para sua conta.">
      <ResetPasswordForm />
    </AuthShell>
  )
}

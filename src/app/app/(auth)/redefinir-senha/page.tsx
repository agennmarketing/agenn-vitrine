import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = { title: 'Criar nova senha' }

// Protegida pelo proxy: só chega aqui quem abriu o link de recuperação (sessão ativa).
export default function ResetPasswordPage() {
  return (
    <AuthShell title="Criar nova senha" description="Escolha uma nova senha para sua conta.">
      <ResetPasswordForm />
    </AuthShell>
  )
}

import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Esqueci minha senha' }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-medium text-ink underline">
          Voltar para entrar
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}

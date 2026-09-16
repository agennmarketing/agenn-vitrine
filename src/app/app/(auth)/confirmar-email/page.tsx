import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResendForm } from './resend-form'

export const metadata = { title: 'Confirme seu e-mail' }

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams
  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={
        email
          ? `Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta.`
          : 'Enviamos um link de confirmação para o seu e-mail. Abra o e-mail para ativar sua conta.'
      }
      footer={
        <Link href="/entrar" className="font-medium text-ink underline">
          Voltar para entrar
        </Link>
      }
    >
      {email ? <ResendForm email={email} /> : null}
    </AuthShell>
  )
}

import { Inbox, MailCheck, MousePointerClick } from 'lucide-react'
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
        <Link href="/entrar" className="hover:underline">
          Voltar para entrar
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <ol className="flex flex-col gap-4 rounded-card border-2 border-line bg-canvas p-5">
          <li className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-go text-go-ink shadow-[0_3px_0_var(--color-go-lip)]"
            >
              <MailCheck className="size-6 animate-pop" strokeWidth={2.5} />
            </span>
            <span className="font-extrabold leading-snug text-ink">Link enviado</span>
          </li>
          <li className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-ink-muted"
            >
              <Inbox className="size-5" strokeWidth={2.5} />
            </span>
            <span className="font-semibold leading-snug text-ink-muted">
              Procure nosso e-mail na caixa de entrada. Não achou? Confira o spam.
            </span>
          </li>
          <li className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-ink-muted"
            >
              <MousePointerClick className="size-5" strokeWidth={2.5} />
            </span>
            <span className="font-semibold leading-snug text-ink-muted">Toque no link: sua conta é ativada e o painel abre.</span>
          </li>
        </ol>
        {email ? <ResendForm email={email} /> : null}
      </div>
    </AuthShell>
  )
}

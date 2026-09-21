import { KeyRound, LogOut, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { signOutAction } from '@/features/auth/actions'
import { signOutEverywhereAction } from '@/features/account/actions'
import { hasPasswordLogin } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from './change-password-form'
import { DeleteAccountForm } from './delete-account-form'
import { NameForm } from './name-form'

export const metadata = { title: 'Conta' }

// Bloco da página: ícone num quadrado, título e apoio curto, conteúdo embaixo.
function Block({
  icon,
  title,
  description,
  tone = 'default',
  children,
}: {
  icon: ReactNode
  title: string
  description?: ReactNode
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  const danger = tone === 'danger'
  return (
    <section
      className={`flex min-w-0 flex-col gap-5 rounded-card border-2 p-5 sm:p-6 ${
        danger ? 'border-danger/30 bg-surface' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-control ${
            danger ? 'bg-danger-soft text-danger' : 'bg-go-soft text-go-strong'
          }`}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1 pt-0.5">
          <h2 className={`text-xl font-black leading-tight tracking-[-0.02em] ${danger ? 'text-danger' : 'text-ink'}`}>
            {title}
          </h2>
          {description ? <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  const email = user.email ?? ''
  const name = profile?.name ?? ''
  const displayName = name || email
  const passwordLogin = hasPasswordLogin(user.identities)

  return (
    <>
      <PanelTopBar
        title="Conta"
        subtitle="Seus dados e o acesso à sua conta"
        actions={
          // No computador o "Sair" fica no rodapé da barra lateral; no celular, aqui.
          <form action={signOutAction} className="lg:hidden">
            <button
              type="submit"
              className="flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-extrabold text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <LogOut aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
              Sair
            </button>
          </form>
        }
      />
      <PanelBody>
        <div className="flex max-w-2xl flex-col gap-6">
          {/* Cartão de identidade: a inicial do usuário em tamanho grande, com nome e e-mail. */}
          <div className="flex items-center gap-4 rounded-card border border-line bg-surface px-5 py-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-go text-2xl font-black text-go-ink shadow-[0_3px_0_var(--color-go-lip)]"
            >
              {displayName.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-lg font-black leading-tight tracking-[-0.02em] text-ink">{displayName}</p>
              {name ? <p className="truncate text-sm font-bold text-ink-muted">{email}</p> : null}
            </div>
          </div>

          <Block icon={<UserRound className="size-6" strokeWidth={2.5} />} title="Perfil" description="Seu nome e o e-mail de acesso.">
            <NameForm name={name} />
            <div className="border-t border-line pt-5">
              <Field label="E-mail" htmlFor="account-email" hint="O e-mail é o identificador da conta e não pode ser alterado.">
                <Input id="account-email" type="email" value={email} readOnly />
              </Field>
            </div>
          </Block>

          <Block
            icon={<ShieldCheck className="size-6" strokeWidth={2.5} />}
            title="Segurança"
            description={passwordLogin ? 'Troque a senha e controle onde sua conta está aberta.' : 'Controle onde sua conta está aberta.'}
          >
            {passwordLogin ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <KeyRound aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={2.5} />
                  <h3 className="text-[1.0625rem] font-extrabold text-ink">Senha</h3>
                </div>
                <p className="-mt-2 text-sm font-semibold leading-5 text-ink-muted">
                  Você continua conectado neste aparelho depois de trocar a senha.
                </p>
                <ChangePasswordForm />
              </div>
            ) : null}

            <div className={`flex flex-col gap-4 ${passwordLogin ? 'border-t border-line pt-5' : ''}`}>
              <div className="flex items-center gap-2">
                <LogOut aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={2.5} />
                <h3 className="text-[1.0625rem] font-extrabold text-ink">Sessões</h3>
              </div>
              <p className="-mt-2 text-sm font-semibold leading-5 text-ink-muted">
                Use se emprestou sua conta ou perdeu acesso a algum aparelho: encerra o acesso em todos os lugares,
                inclusive neste. Você vai precisar entrar de novo.
              </p>
              <form action={signOutEverywhereAction}>
                <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                  Sair de todos os aparelhos
                </Button>
              </form>
            </div>
          </Block>

          <Block
            tone="danger"
            icon={<TriangleAlert className="size-6" strokeWidth={2.5} />}
            title="Excluir conta"
            description="Não dá para desfazer."
          >
            <p className="-mt-1 text-[0.9375rem] font-semibold leading-relaxed text-ink-muted">
              Cancela sua assinatura e apaga suas vitrines, itens, fotos e vídeos. Os links das suas vitrines param de
              funcionar na hora. Se você tem assinatura ativa, ela é encerrada na hora e o tempo restante do período já pago
              não é devolvido.
            </p>
            <DeleteAccountForm email={email} />
          </Block>

          <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink-muted">
            <a href="/termos" className="hover:text-ink hover:underline">
              Termos de uso
            </a>
            <a href="/privacidade" className="hover:text-ink hover:underline">
              Política de privacidade
            </a>
          </p>
        </div>
      </PanelBody>
    </>
  )
}

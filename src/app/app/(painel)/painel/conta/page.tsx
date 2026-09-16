import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { signOutEverywhereAction } from '@/features/account/actions'
import { hasPasswordLogin } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from './change-password-form'
import { NameForm } from './name-form'

export const metadata = { title: 'Conta' }

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="mt-1 text-ink-muted">Gerencie seus dados e o acesso à sua conta.</p>
      </div>

      <Card className="flex flex-col gap-5">
        <h2 className="text-lg font-medium leading-tight">Dados pessoais</h2>
        <NameForm name={profile?.name ?? ''} />
        <div className="border-t border-line pt-5">
          <Field label="E-mail" htmlFor="account-email" hint="O e-mail é o identificador da conta e não pode ser alterado.">
            <Input id="account-email" type="email" value={user.email ?? ''} readOnly />
          </Field>
        </div>
      </Card>

      {hasPasswordLogin(user.identities) ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-medium leading-tight">Senha</h2>
            <p className="mt-1 text-sm leading-5 text-ink-muted">
              Você continua conectado neste aparelho depois de trocar a senha.
            </p>
          </div>
          <ChangePasswordForm />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium leading-tight">Sessões</h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted">
            Use se emprestou sua conta ou perdeu acesso a algum aparelho: encerra o acesso em todos os lugares,
            inclusive neste. Você vai precisar entrar de novo.
          </p>
        </div>
        <form action={signOutEverywhereAction}>
          <Button type="submit" variant="secondary">
            Sair de todos os aparelhos
          </Button>
        </form>
      </Card>
    </div>
  )
}

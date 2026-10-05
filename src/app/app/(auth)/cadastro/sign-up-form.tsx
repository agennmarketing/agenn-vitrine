'use client'

import { useActionState } from 'react'
import { GoogleButton } from '@/components/auth/google-button'
import { PasswordInput } from '@/components/auth/password-input'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { SubmitButton } from '@/components/ui/submit-button'
import { signUpAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

// perfil: o negócio da página de vendas de onde a pessoa veio (manicure, loja...).
export function SignUpForm({ perfil }: { perfil: string | null }) {
  const [state, formAction] = useActionState(signUpAction, initialFormState)
  const errors = state.fieldErrors ?? {}

  return (
    <div className="flex flex-col gap-6">
      <GoogleButton next={perfil ? `/painel/vitrines/nova?perfil=${perfil}` : undefined} />
      <form action={formAction} noValidate className="flex flex-col gap-4">
        {perfil ? <input type="hidden" name="perfil" value={perfil} /> : null}
        <Field label="Nome" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} invalid={!!errors.name} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <MaskedInput mask="email" id="email" name="email" defaultValue={state.values?.email} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
          <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!errors.password} />
        </Field>
        <Turnstile resetSignal={state} />
        <FormMessage error={state.error} />
        <SubmitButton>Criar conta</SubmitButton>
        <p className="text-center text-sm font-semibold leading-5 text-ink-muted">
          Ao criar a conta, você concorda com os{' '}
          <a href="/termos" target="_blank" rel="noreferrer" className="font-extrabold text-ink underline decoration-line-strong hover:decoration-go-strong">
            Termos de uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" rel="noreferrer" className="font-extrabold text-ink underline decoration-line-strong hover:decoration-go-strong">
            Política de privacidade
          </a>
          .
        </p>
      </form>
    </div>
  )
}

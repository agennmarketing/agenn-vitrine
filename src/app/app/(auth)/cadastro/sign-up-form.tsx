'use client'

import { useActionState } from 'react'
import { GoogleButton } from '@/components/auth/google-button'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { signUpAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialFormState)
  const errors = state.fieldErrors ?? {}

  return (
    <div className="flex flex-col gap-6">
      <GoogleButton />
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} invalid={!!errors.name} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!errors.password} />
        </Field>
        <Turnstile resetSignal={state} />
        <FormMessage error={state.error} />
        <SubmitButton>Criar conta</SubmitButton>
        <p className="text-center text-xs leading-5 text-ink-muted">
          Ao criar a conta, você concorda com os{' '}
          <a href="/termos" target="_blank" rel="noreferrer" className="underline">
            Termos de uso
          </a>{' '}
          e a{' '}
          <a href="/privacidade" target="_blank" rel="noreferrer" className="underline">
            Política de privacidade
          </a>
          .
        </p>
      </form>
    </div>
  )
}

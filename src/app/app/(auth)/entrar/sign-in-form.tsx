'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { GoogleButton } from '@/components/auth/google-button'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { signInAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function SignInForm({
  next,
  notice,
}: {
  next: string
  notice: { kind: 'error' | 'success'; text: string } | null
}) {
  const [state, formAction] = useActionState(signInAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  const submitted = state !== initialFormState

  return (
    <div className="flex flex-col gap-6">
      {!submitted && notice ? (
        <FormMessage error={notice.kind === 'error' ? notice.text : undefined} success={notice.kind === 'success' ? notice.text : undefined} />
      ) : null}
      <GoogleButton next={next} />
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" invalid={!!errors.password} />
        </Field>
        <Link href="/esqueci-senha" className="self-end text-sm font-medium text-ink underline">
          Esqueci minha senha
        </Link>
        <Turnstile resetSignal={state} />
        <FormMessage error={state.error} />
        <SubmitButton>Entrar</SubmitButton>
      </form>
    </div>
  )
}

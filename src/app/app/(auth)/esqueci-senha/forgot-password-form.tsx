'use client'

import { useActionState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { forgotPasswordAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
      </Field>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton>Enviar link</SubmitButton>
    </form>
  )
}

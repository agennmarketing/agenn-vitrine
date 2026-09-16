'use client'

import { useActionState } from 'react'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { resetPasswordAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialFormState)
  const errors = state.fieldErrors ?? {}
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="Nova senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} />
      </Field>
      <FormMessage error={state.error} />
      <SubmitButton>Salvar nova senha</SubmitButton>
    </form>
  )
}

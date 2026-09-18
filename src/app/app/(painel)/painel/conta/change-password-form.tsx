'use client'

import { useActionState, useEffect, useRef } from 'react'
import { PasswordInput } from '@/components/auth/password-input'
import { Turnstile } from '@/components/auth/turnstile'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/submit-button'
import { changePasswordAction } from '@/features/account/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialFormState)
  const formRef = useRef<HTMLFormElement>(null)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="Senha atual" htmlFor="currentPassword" error={errors.currentPassword}>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" invalid={!!errors.currentPassword} />
      </Field>
      <Field label="Nova senha" htmlFor="password" error={errors.password} hint="Mínimo de 8 caracteres.">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" invalid={!!errors.confirmPassword} />
      </Field>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
        {pending ? <Spinner /> : null}
        Trocar senha
      </Button>
    </form>
  )
}

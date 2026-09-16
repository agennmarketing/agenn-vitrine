'use client'

import { useActionState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'
import { resendConfirmationAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ResendForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resendConfirmationAction, initialFormState)
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton variant="secondary">Reenviar link</SubmitButton>
    </form>
  )
}

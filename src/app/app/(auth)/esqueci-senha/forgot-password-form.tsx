'use client'

import { MailCheck } from 'lucide-react'
import { useActionState, useState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { forgotPasswordAction } from '@/features/auth/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialFormState)
  // Guarda qual envio a pessoa já dispensou, para voltar ao formulário sem perder o estado da ação.
  const [dismissed, setDismissed] = useState<typeof state | null>(null)
  const errors = state.fieldErrors ?? {}

  if (state.success && dismissed !== state) {
    return (
      <div className="flex animate-rise flex-col items-center gap-5 rounded-card border-2 border-line bg-canvas px-5 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-go text-go-ink shadow-[0_4px_0_var(--color-go-lip)]"
        >
          <MailCheck className="size-8 animate-pop" strokeWidth={2.5} />
        </span>
        <div className="flex flex-col gap-2">
          <p role="status" className="text-lg font-extrabold leading-snug text-ink">
            {state.success}
          </p>
          <p className="text-[0.9375rem] font-semibold leading-relaxed text-ink-muted">
            Abra o e-mail e toque no link para criar a nova senha. Não chegou em alguns minutos? Confira a caixa de spam.
          </p>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => setDismissed(state)}>
          Enviar de novo
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!errors.email} />
      </Field>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} />
      <SubmitButton>Enviar link</SubmitButton>
    </form>
  )
}

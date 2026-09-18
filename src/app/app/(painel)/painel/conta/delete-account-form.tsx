'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteAccountAction } from '@/features/account/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialFormState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)} className="self-start">
        Excluir conta
      </Button>
    )
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field
        label="Digite o e-mail da conta para confirmar"
        htmlFor="confirm-email"
        error={state.fieldErrors?.confirm}
        hint={email}
      >
        <Input id="confirm-email" name="confirm" autoComplete="off" invalid={Boolean(state.fieldErrors?.confirm)} />
      </Field>
      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
          Excluir minha conta
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

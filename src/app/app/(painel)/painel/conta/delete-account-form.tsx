'use client'

import { TriangleAlert } from 'lucide-react'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { deleteAccountAction } from '@/features/account/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialFormState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)} className="w-full sm:w-auto sm:self-start">
        Excluir conta
      </Button>
    )
  }

  return (
    <form action={formAction} noValidate className="flex animate-rise flex-col gap-4 rounded-control border-2 border-danger/25 bg-danger-soft/60 p-4">
      <p className="flex items-start gap-2.5 text-[0.9375rem] font-bold leading-5 text-danger">
        <TriangleAlert aria-hidden="true" className="mt-px size-5 shrink-0" strokeWidth={2.5} />
        <span>
          Último passo. Para confirmar, digite <span className="break-all font-black">{email}</span> no campo abaixo.
        </span>
      </p>
      <Field label="Digite o e-mail da conta para confirmar" htmlFor="confirm-email" error={state.fieldErrors?.confirm}>
        <Input
          id="confirm-email"
          name="confirm"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          invalid={Boolean(state.fieldErrors?.confirm)}
        />
      </Field>
      <FormMessage error={state.error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          Excluir minha conta
        </Button>
      </div>
    </form>
  )
}

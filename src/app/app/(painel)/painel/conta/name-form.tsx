'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { updateNameAction } from '@/features/account/actions'

export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateNameAction, { values: { name } })
  const error = state.fieldErrors?.name
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Nome" htmlFor="name" error={error}>
        <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name ?? name} invalid={!!error} />
      </Field>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} className="self-start">
        Salvar nome
      </Button>
    </form>
  )
}

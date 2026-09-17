'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteVitrineAction } from '@/features/vitrines/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function DeleteVitrineForm({ vitrineId, subdomain }: { vitrineId: string; subdomain: string }) {
  const [state, formAction, pending] = useActionState(deleteVitrineAction.bind(null, vitrineId), initialFormState)
  const error = state.fieldErrors?.confirm
  return (
    <Card className="p-5">
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Excluir vitrine</h2>
        <p className="text-sm text-ink-muted">Isso apaga a vitrine, os itens e as imagens. Não dá para desfazer.</p>
        <Field label="Digite o endereço da vitrine para confirmar" htmlFor="confirm" error={error}>
          <Input id="confirm" name="confirm" placeholder={subdomain} autoCapitalize="none" invalid={!!error} />
        </Field>
        <FormMessage error={state.error} />
        <Button type="submit" variant="danger" disabled={pending} className="self-start">
          Excluir definitivamente
        </Button>
      </form>
    </Card>
  )
}

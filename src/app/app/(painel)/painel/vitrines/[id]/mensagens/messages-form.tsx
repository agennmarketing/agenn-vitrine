'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateMessagesAction } from '@/features/vitrines/actions'

export function MessagesForm({ vitrineId, defaultButtonText }: { vitrineId: string; defaultButtonText: string }) {
  const [state, formAction, pending] = useActionState(updateMessagesAction.bind(null, vitrineId), {
    values: { defaultButtonText },
  })
  const error = state.fieldErrors?.defaultButtonText
  return (
    <Card className="p-5">
      <form id="messages-form" action={formAction} noValidate className="flex flex-col gap-4">
        <Field label="Texto padrão do botão" htmlFor="defaultButtonText" error={error}>
          <Input
            id="defaultButtonText"
            name="defaultButtonText"
            maxLength={30}
            defaultValue={state.values?.defaultButtonText ?? defaultButtonText}
            invalid={!!error}
          />
        </Field>
        <p className="text-sm text-ink-muted">
          A mensagem personalizada de cada item fica em Itens → Avançado. A sacola chega em uma próxima atualização.
        </p>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Salvar mensagens
        </Button>
      </form>
      <UnsavedChangesGuard formId="messages-form" />
    </Card>
  )
}

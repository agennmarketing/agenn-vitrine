'use client'

import { Trash2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfigBlock } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { deleteVitrineAction } from '@/features/vitrines/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function DeleteVitrineForm({ vitrineId, subdomain }: { vitrineId: string; subdomain: string }) {
  const [state, formAction, pending] = useActionState(deleteVitrineAction.bind(null, vitrineId), initialFormState)
  const error = state.fieldErrors?.confirm
  return (
    <ConfigBlock
      tone="danger"
      title="Excluir vitrine"
      description="Isso apaga a vitrine, os itens e as imagens. Não dá para desfazer."
    >
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <Field label="Digite o endereço da vitrine para confirmar" htmlFor="confirm" error={error}>
          <Input
            id="confirm"
            name="confirm"
            placeholder={subdomain}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            invalid={!!error}
          />
        </Field>
        <FormMessage error={state.error} />
        <Button type="submit" variant="danger" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? <Spinner /> : <Trash2 aria-hidden="true" className="size-5" strokeWidth={2.5} />}
          Excluir definitivamente
        </Button>
      </form>
    </ConfigBlock>
  )
}

'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateCheckoutAction } from '@/features/vitrines/actions'

type Values = {
  cartEnabled: string
  cartButtonText: string
  defaultButtonText: string
  nameMode: string
  fulfillmentMode: string
  paymentMode: string
  scheduleMode: string
  notesMode: string
  paymentOptions: string
}

const MODE_FIELDS = [
  ['nameMode', 'Nome'],
  ['fulfillmentMode', 'Retirada ou entrega'],
  ['paymentMode', 'Forma de pagamento'],
  ['scheduleMode', 'Data e horário'],
  ['notesMode', 'Observações'],
] as const

const selectClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

export function MessagesForm({ vitrineId, initial }: { vitrineId: string; initial: Values }) {
  const [state, formAction, pending] = useActionState(updateCheckoutAction.bind(null, vitrineId), { values: initial })
  const errors = state.fieldErrors ?? {}
  const values = (state.values ?? initial) as Values

  return (
    <Card className="p-5">
      <form id="messages-form" action={formAction} noValidate className="flex flex-col gap-5">
        <Field label="Texto padrão do botão" htmlFor="defaultButtonText" error={errors.defaultButtonText}>
          <Input id="defaultButtonText" name="defaultButtonText" maxLength={30} defaultValue={values.defaultButtonText} invalid={!!errors.defaultButtonText} />
        </Field>
        <p className="text-sm text-ink-muted">A mensagem personalizada de cada item fica em Itens → Avançado.</p>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="cartEnabled" defaultChecked={values.cartEnabled === 'on'} />
          Usar sacola
        </label>
        <Field label="Texto do botão da sacola" htmlFor="cartButtonText" error={errors.cartButtonText}>
          <Input id="cartButtonText" name="cartButtonText" maxLength={30} defaultValue={values.cartButtonText} invalid={!!errors.cartButtonText} />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium">Formulário da sacola</legend>
          {MODE_FIELDS.map(([name, label]) => (
            <Field key={name} label={label} htmlFor={name}>
              <select id={name} name={name} defaultValue={values[name]} className={selectClass}>
                <option value="off">Desligado</option>
                <option value="optional">Opcional</option>
                <option value="required">Obrigatório</option>
              </select>
            </Field>
          ))}
          <Field label="Formas de pagamento (uma por linha)" htmlFor="paymentOptions" error={errors.paymentOptions}>
            <textarea
              id="paymentOptions"
              name="paymentOptions"
              rows={4}
              defaultValue={values.paymentOptions}
              className="w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-base"
            />
          </Field>
          <p className="text-sm text-ink-muted">Com &quot;Dinheiro&quot;, o formulário pergunta &quot;Troco para quanto?&quot;.</p>
        </fieldset>

        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Salvar mensagens
        </Button>
      </form>
      <UnsavedChangesGuard formId="messages-form" />
    </Card>
  )
}

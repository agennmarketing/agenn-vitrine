'use client'

import { CalendarClock, MessageSquareText, Store, UserRound, Wallet } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfigBlock, ConfigToggle, SaveBar } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
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
  ['nameMode', 'Nome', UserRound],
  ['fulfillmentMode', 'Retirada ou entrega', Store],
  ['paymentMode', 'Forma de pagamento', Wallet],
  ['scheduleMode', 'Data e horário', CalendarClock],
  ['notesMode', 'Observações', MessageSquareText],
] as const

export function MessagesForm({ vitrineId, initial }: { vitrineId: string; initial: Values }) {
  const [state, formAction, pending] = useActionState(updateCheckoutAction.bind(null, vitrineId), { values: initial })
  const errors = state.fieldErrors ?? {}
  const values = (state.values ?? initial) as Values

  return (
    <>
      <form id="messages-form" action={formAction} noValidate className="flex flex-col gap-5">
        <ConfigBlock title="Botão dos itens" description="O texto do botão que leva o cliente ao WhatsApp.">
          <Field label="Texto padrão do botão" htmlFor="defaultButtonText" error={errors.defaultButtonText}>
            <Input
              id="defaultButtonText"
              name="defaultButtonText"
              maxLength={30}
              defaultValue={values.defaultButtonText}
              invalid={!!errors.defaultButtonText}
            />
          </Field>
          <p className="-mt-2 text-sm font-semibold text-ink-muted">
            A mensagem personalizada de cada item fica em Itens → Avançado.
          </p>
        </ConfigBlock>

        <ConfigBlock title="Sacola" description="Com a sacola, o cliente junta vários itens e envia um pedido só.">
          <ConfigToggle
            id="cartEnabled"
            name="cartEnabled"
            title="Usar sacola"
            description="Desligada, cada item abre o WhatsApp direto."
            defaultChecked={values.cartEnabled === 'on'}
            className="rounded-control bg-canvas p-4"
          />
          <Field label="Texto do botão da sacola" htmlFor="cartButtonText" error={errors.cartButtonText}>
            <Input
              id="cartButtonText"
              name="cartButtonText"
              maxLength={30}
              defaultValue={values.cartButtonText}
              invalid={!!errors.cartButtonText}
            />
          </Field>
        </ConfigBlock>

        <ConfigBlock
          title="Formulário da sacola"
          description="O que o cliente preenche antes de enviar. Desligado não aparece; opcional pode ficar em branco."
        >
          <ul className="flex flex-col divide-y divide-line rounded-control border-2 border-line">
            {MODE_FIELDS.map(([name, label, Icon]) => (
              <li key={name} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <label htmlFor={name} className="flex min-w-0 items-center gap-3 font-extrabold leading-snug text-ink">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-subtle text-ink">
                    <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
                  </span>
                  {label}
                </label>
                <Select id={name} name={name} defaultValue={values[name]} className="h-11 w-[9.25rem] shrink-0 text-[0.9375rem]">
                  <option value="off">Desligado</option>
                  <option value="optional">Opcional</option>
                  <option value="required">Obrigatório</option>
                </Select>
              </li>
            ))}
          </ul>
          <Field label="Formas de pagamento (uma por linha)" htmlFor="paymentOptions" error={errors.paymentOptions}>
            <Textarea
              id="paymentOptions"
              name="paymentOptions"
              rows={4}
              defaultValue={values.paymentOptions}
              invalid={!!errors.paymentOptions}
            />
          </Field>
          <p className="-mt-2 text-sm font-semibold text-ink-muted">
            Com &quot;Dinheiro&quot;, o formulário pergunta &quot;Troco para quanto?&quot;.
          </p>
        </ConfigBlock>

        <SaveBar>
          <FormMessage error={state.error} success={state.success} />
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full lg:w-auto lg:self-start">
            {pending ? <Spinner /> : null}
            Salvar mensagens
          </Button>
        </SaveBar>
      </form>
      <UnsavedChangesGuard formId="messages-form" />
    </>
  )
}

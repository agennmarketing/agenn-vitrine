'use client'

import { ChevronDown, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { ConfigBlock } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import {
  addContactAction,
  removeContactAction,
  setPrimaryContactAction,
  updateContactAction,
} from '@/features/whatsapp/actions'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

type Contact = { id: string; label: string; phone: string }

export function Contacts({
  vitrineId,
  primaryId,
  contacts,
}: {
  vitrineId: string
  primaryId: string | null
  contacts: Contact[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action()
      setMessage(result)
      if (!result.error) router.refresh()
    })
  }

  // O principal vem primeiro: é para ele que vão os pedidos.
  const ordered = [...contacts].sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId))

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {ordered.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {ordered.map((contact) => {
            const primary = contact.id === primaryId
            return (
              <li
                key={contact.id}
                className={`flex flex-col gap-4 rounded-card border-2 bg-surface p-5 sm:p-6 ${primary ? 'border-go' : 'border-line'}`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className={`flex size-12 shrink-0 items-center justify-center rounded-control ${
                      primary ? 'bg-deep text-deep-ink' : 'bg-go-soft text-go-strong'
                    }`}
                  >
                    <Phone className="size-6" strokeWidth={2.5} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="min-w-0 break-words text-lg font-black leading-snug tracking-[-0.02em] text-ink">
                        {contact.label}
                      </h3>
                      {primary ? (
                        <Badge tone="go">
                          <Star aria-hidden="true" className="size-3.5 fill-current" strokeWidth={2.5} />
                          Principal
                        </Badge>
                      ) : null}
                    </div>
                    <p className="numeric font-bold text-ink-muted">{contact.phone}</p>
                  </div>
                </div>

                {primary ? (
                  <p className="text-sm font-semibold text-ink-muted">Os pedidos da vitrine chegam neste número.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setPrimaryContactAction(vitrineId, contact.id))}
                    >
                      <Star aria-hidden="true" className="size-4" strokeWidth={2.5} />
                      Tornar principal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="text-danger hover:bg-danger-soft active:bg-danger-soft"
                      onClick={() => run(() => removeContactAction(vitrineId, contact.id))}
                    >
                      <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                      Remover
                    </Button>
                  </div>
                )}

                <details className="group/edit border-t-2 border-line pt-4">
                  <summary
                    className={buttonClasses(
                      'ghost',
                      '-ml-2 w-fit cursor-pointer list-none text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden',
                      'sm',
                    )}
                  >
                    <Pencil aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    Editar nome e número
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 group-open/edit:rotate-180"
                      strokeWidth={3}
                    />
                  </summary>
                  <div className="pt-4">
                    <ContactForm vitrineId={vitrineId} contact={contact} />
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      ) : null}

      <NewContactForm vitrineId={vitrineId} onAdded={() => router.refresh()} />
    </div>
  )
}

function ContactForm({ vitrineId, contact }: { vitrineId: string; contact: Contact }) {
  const [state, formAction, pending] = useActionState(updateContactAction.bind(null, vitrineId, contact.id), {
    values: { label: contact.label, phone: contact.phone },
  })
  const errors = state.fieldErrors ?? {}
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do contato" htmlFor={`label-${contact.id}`} error={errors.label}>
          <Input id={`label-${contact.id}`} name="label" defaultValue={state.values?.label} invalid={!!errors.label} />
        </Field>
        <Field label="Número" htmlFor={`phone-${contact.id}`} error={errors.phone}>
          <Input
            id={`phone-${contact.id}`}
            name="phone"
            type="tel"
            inputMode="tel"
            className="numeric"
            defaultValue={state.values?.phone}
            invalid={!!errors.phone}
          />
        </Field>
      </div>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
        {pending ? <Spinner /> : null}
        Salvar contato
      </Button>
    </form>
  )
}

function NewContactForm({ vitrineId, onAdded }: { vitrineId: string; onAdded: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addContactAction(vitrineId, prev, formData)
    if (result.success) onAdded()
    return result
  }, initialFormState)
  const errors = state.fieldErrors ?? {}
  return (
    <ConfigBlock title="Adicionar contato" description="Balcão, delivery, outra unidade. Você escolhe qual é o principal.">
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do novo contato" htmlFor="new-label" error={errors.label}>
            <Input id="new-label" name="label" placeholder="Delivery" defaultValue={state.values?.label} invalid={!!errors.label} />
          </Field>
          <Field label="Número do novo contato" htmlFor="new-phone" error={errors.phone}>
            <Input
              id="new-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 98765-4321"
              className="numeric"
              defaultValue={state.values?.phone}
              invalid={!!errors.phone}
            />
          </Field>
        </div>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? <Spinner /> : <Plus aria-hidden="true" className="size-5" strokeWidth={3} />}
          Adicionar contato
        </Button>
      </form>
    </ConfigBlock>
  )
}

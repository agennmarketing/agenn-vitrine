'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
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

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        <FormMessage error={message.error} success={message.success} />
      </div>
      {contacts.map((contact) => (
        <Card key={contact.id} className="flex flex-col gap-3 p-5">
          <ContactForm vitrineId={vitrineId} contact={contact} />
          <div className="flex flex-wrap items-center gap-2">
            {contact.id === primaryId ? (
              <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium">Principal</span>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => setPrimaryContactAction(vitrineId, contact.id))}
                >
                  Tornar principal
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => removeContactAction(vitrineId, contact.id))}
                >
                  Remover
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
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
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Nome do contato" htmlFor={`label-${contact.id}`} error={errors.label}>
        <Input id={`label-${contact.id}`} name="label" defaultValue={state.values?.label} invalid={!!errors.label} />
      </Field>
      <Field label="Número" htmlFor={`phone-${contact.id}`} error={errors.phone}>
        <Input
          id={`phone-${contact.id}`}
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={state.values?.phone}
          invalid={!!errors.phone}
        />
      </Field>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
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
    <Card className="p-5">
      <form action={formAction} noValidate className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Adicionar contato</h2>
        <Field label="Nome do novo contato" htmlFor="new-label" error={errors.label}>
          <Input id="new-label" name="label" defaultValue={state.values?.label} invalid={!!errors.label} />
        </Field>
        <Field label="Número do novo contato" htmlFor="new-phone" error={errors.phone}>
          <Input
            id="new-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 98765-4321"
            defaultValue={state.values?.phone}
            invalid={!!errors.phone}
          />
        </Field>
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Adicionar contato
        </Button>
      </form>
    </Card>
  )
}

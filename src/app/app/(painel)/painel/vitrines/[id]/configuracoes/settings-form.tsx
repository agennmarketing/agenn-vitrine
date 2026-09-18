'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateSettingsAction } from '@/features/vitrines/actions'
import { fetchAvailability } from '@/lib/forms/availability'
import type { FormState } from '@/lib/forms/form-state'

type Values = { name: string; description: string; subdomain: string }

export function SettingsForm({ vitrineId, rootDomain, initial }: { vitrineId: string; rootDomain: string; initial: Values }) {
  const [savedSubdomain, setSavedSubdomain] = useState(initial.subdomain)
  const [typedSubdomain, setTypedSubdomain] = useState(initial.subdomain)
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateSettingsAction(vitrineId, prev, formData)
    if (result.success && result.values?.subdomain) {
      setSavedSubdomain(result.values.subdomain)
      setTypedSubdomain(result.values.subdomain)
    }
    return result
  }, { values: initial })

  const [availability, setAvailability] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef<AbortController>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inFlight.current?.abort()
    },
    [],
  )
  function onSubdomainChange(value: string) {
    setTypedSubdomain(value)
    setAvailability(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    if (!value.trim() || value.trim().toLowerCase() === savedSubdomain) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const result = await fetchAvailability(
        `/api/disponibilidade/subdominio?valor=${encodeURIComponent(value)}&vitrine=${vitrineId}`,
        controller.signal,
      )
      if (result) setAvailability(result)
    }, 400)
  }

  const errors = state.fieldErrors ?? {}
  const values = state.values ?? initial
  const changingSubdomain = typedSubdomain.trim().toLowerCase() !== savedSubdomain

  return (
    <Card className="p-5">
      <form id="settings-form" action={formAction} noValidate className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Configurações</h2>
        <Field label="Nome da vitrine" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" defaultValue={values.name} maxLength={60} invalid={!!errors.name} />
        </Field>
        <Field label="Descrição" htmlFor="description" error={errors.description}>
          <textarea
            id="description"
            name="description"
            defaultValue={values.description}
            maxLength={300}
            rows={3}
            className="w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-base"
          />
        </Field>
        <Field label="Endereço da vitrine" htmlFor="subdomain" error={errors.subdomain}>
          <div className="flex items-center gap-2">
            <Input
              id="subdomain"
              name="subdomain"
              defaultValue={values.subdomain}
              maxLength={30}
              autoCapitalize="none"
              invalid={!!errors.subdomain}
              onChange={(event) => onSubdomainChange(event.target.value)}
            />
            <span className="shrink-0 text-sm text-ink-muted">.{rootDomain}</span>
          </div>
        </Field>
        {availability ? (
          <p className={`text-sm ${availability.ok ? 'text-brand' : 'text-danger'}`} aria-live="polite">
            {availability.message}
          </p>
        ) : null}
        {changingSubdomain ? (
          <div className="flex flex-col gap-2 rounded-control bg-subtle p-3 text-sm">
            <p>O endereço antigo deixará de funcionar imediatamente.</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirmSubdomainChange" />
              Entendi que o link antigo vai parar de funcionar
            </label>
            {errors.confirmSubdomainChange ? (
              <p role="alert" className="text-danger">
                {errors.confirmSubdomainChange}
              </p>
            ) : null}
          </div>
        ) : null}
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Salvar configurações
        </Button>
      </form>
      <UnsavedChangesGuard formId="settings-form" />
    </Card>
  )
}

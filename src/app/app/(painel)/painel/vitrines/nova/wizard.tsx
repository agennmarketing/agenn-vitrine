'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { createVitrineAction } from '@/features/vitrines/actions'
import { fetchAvailability } from '@/lib/forms/availability'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

const STEPS = ['Tipo', 'Nome e endereço', 'WhatsApp', 'Aparência'] as const

function stepForErrors(errors: FormState['fieldErrors']): number | null {
  if (!errors) return null
  if (errors.type) return 0
  if (errors.name || errors.subdomain) return 1
  if (errors.whatsappPhone || errors.whatsappLabel) return 2
  return 3
}

export function VitrineWizard({ rootDomain }: { rootDomain: string }) {
  const [step, setStep] = useState(0)
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await createVitrineAction(prev, formData)
    const errorStep = stepForErrors(result.fieldErrors)
    if (errorStep !== null) setStep(errorStep)
    return result
  }, initialFormState)

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
    setAvailability(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    if (!value.trim()) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const result = await fetchAvailability(
        `/api/disponibilidade/subdominio?valor=${encodeURIComponent(value)}`,
        controller.signal,
      )
      if (result) setAvailability(result)
    }, 400)
  }

  const errors = state.fieldErrors ?? {}
  const values = state.values ?? {}

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col gap-5 p-6">
      <div>
        <p className="text-sm text-ink-muted">
          Passo {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Nova vitrine</h1>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-5">
        <fieldset hidden={step !== 0} className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">Que tipo de vitrine?</legend>
          {[
            ['produtos', 'Produtos', 'Lojas e catálogos. Botão "Solicitar orçamento".'],
            ['servicos', 'Serviços', 'Profissionais e clínicas. Botão "Agendar".'],
            ['comida', 'Comida', 'Hamburguerias, pizzarias e lanchonetes. Botão "Pedir" e sacola ligada.'],
          ].map(([value, label, hint]) => (
            <label key={value} className="flex items-start gap-3 rounded-control border border-line p-3">
              <input type="radio" name="type" value={value} defaultChecked={values.type === value} aria-label={label} />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-ink-muted">{hint}</span>
              </span>
            </label>
          ))}
          <p className="text-sm text-ink-muted">O tipo não poderá ser alterado depois.</p>
          <FormMessage error={errors.type} />
        </fieldset>

        <fieldset hidden={step !== 1} className="flex flex-col gap-4">
          <Field label="Nome da vitrine" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={60} invalid={!!errors.name} />
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
        </fieldset>

        <fieldset hidden={step !== 2} className="flex flex-col gap-4">
          <Field label="WhatsApp" htmlFor="whatsappPhone" error={errors.whatsappPhone}>
            <Input
              id="whatsappPhone"
              name="whatsappPhone"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98765-4321"
              defaultValue={values.whatsappPhone}
              invalid={!!errors.whatsappPhone}
            />
          </Field>
          <Field label="Nome do contato" htmlFor="whatsappLabel" error={errors.whatsappLabel}>
            <Input id="whatsappLabel" name="whatsappLabel" placeholder="Principal" defaultValue={values.whatsappLabel} />
          </Field>
        </fieldset>

        <fieldset hidden={step !== 3} className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">Tema</legend>
          {[
            ['light', 'Claro'],
            ['dark', 'Escuro'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                value={value}
                defaultChecked={(values.theme || 'light') === value}
                aria-label={label}
              />
              {label}
            </label>
          ))}
          <div className="rounded-control border border-dashed border-line p-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">Logo, cor da marca e banner</span> · Pro. Disponível no plano Pro.
          </div>
        </fieldset>

        <FormMessage error={state.error} />

        <div className="flex justify-between gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {/* Chaves diferentes: sem elas o React reaproveita o mesmo <button> e o troca
              para submit durante o clique em Continuar, enviando o formulário antes da hora. */}
          {step < STEPS.length - 1 ? (
            <Button key="next" onClick={() => setStep(step + 1)}>
              Continuar
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={pending}>
              Criar vitrine
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}

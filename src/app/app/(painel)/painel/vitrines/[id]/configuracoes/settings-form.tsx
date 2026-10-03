'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfigBlock, SaveBar } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Textarea } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateSettingsAction } from '@/features/vitrines/actions'
import { fetchAvailability } from '@/lib/forms/availability'
import { filterSubdomainField } from '@/lib/forms/subdomain-field'
import type { FormState } from '@/lib/forms/form-state'

type Values = { name: string; description: string; subdomain: string; instagram: string; address: string; whatsappPhone: string }

/** Campos de contato que esta vitrine mostra: WhatsApp e horários só em serviços, endereço fora do afiliado. */
type ContactFields = { whatsapp: boolean; address: boolean; hours: boolean }

export function SettingsForm({
  vitrineId,
  rootDomain,
  contact,
  initial,
}: {
  vitrineId: string
  rootDomain: string
  contact: ContactFields
  initial: Values
}) {
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
    <>
      <form id="settings-form" action={formAction} noValidate className="flex flex-col gap-5">
        <ConfigBlock title="Nome e descrição" description="Aparecem no topo da vitrine e quando o link é compartilhado.">
          <Field label="Nome da vitrine" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={60} invalid={!!errors.name} />
          </Field>
          <Field label="Descrição" htmlFor="description" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={values.description}
              maxLength={300}
              rows={3}
              invalid={!!errors.description}
            />
          </Field>
        </ConfigBlock>

        <ConfigBlock title="Contato" description="Aparecem no topo da vitrine para o cliente falar com você e te encontrar.">
          {contact.whatsapp ? (
            <Field
              label="WhatsApp"
              htmlFor="whatsappPhone"
              error={errors.whatsappPhone}
              hint="Recebe os avisos dos clientes depois que eles agendam."
            >
              <Input
                id="whatsappPhone"
                name="whatsappPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
                defaultValue={values.whatsappPhone}
                invalid={!!errors.whatsappPhone}
              />
            </Field>
          ) : null}
          <Field label="Instagram (opcional)" htmlFor="instagram" error={errors.instagram}>
            <div className="flex items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface focus-within:border-go-strong has-[[aria-invalid]]:border-danger">
              <span className="flex shrink-0 items-center bg-subtle px-3 text-sm font-extrabold text-ink-muted">@</span>
              <Input
                id="instagram"
                name="instagram"
                defaultValue={values.instagram}
                maxLength={80}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="seuestudio"
                invalid={!!errors.instagram}
                className="rounded-none border-0 bg-transparent"
              />
            </div>
          </Field>
          {contact.address ? (
            <Field
              label="Endereço de atendimento (opcional)"
              htmlFor="address"
              error={errors.address}
              hint="Rua, número e bairro. Deixe em branco se atende a domicílio."
            >
              <Input
                id="address"
                name="address"
                maxLength={200}
                autoComplete="street-address"
                placeholder="Ex.: Rua das Flores, 120 - Centro"
                defaultValue={values.address}
                invalid={!!errors.address}
              />
            </Field>
          ) : null}
          {contact.hours ? (
            <p className="text-sm leading-5 text-ink-muted">
              Os horários de atendimento que aparecem na vitrine são os da{' '}
              <Link href="/painel/agenda?secao=configurar" className="font-extrabold text-go-strong underline underline-offset-2">
                Agenda
              </Link>
              .
            </p>
          ) : null}
        </ConfigBlock>

        <ConfigBlock title="Endereço" description="O link que você divulga para os clientes.">
          <Field label="Endereço da vitrine" htmlFor="subdomain" error={errors.subdomain}>
            <div className="flex items-stretch overflow-hidden rounded-control border-2 border-line-strong bg-surface focus-within:border-go-strong has-[[aria-invalid]]:border-danger">
              <Input
                id="subdomain"
                name="subdomain"
                defaultValue={values.subdomain}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                invalid={!!errors.subdomain}
                className="rounded-none border-0 bg-transparent"
                onChange={(event) => onSubdomainChange(filterSubdomainField(event.target))}
              />
              <span className="flex max-w-[45%] shrink-0 items-center truncate bg-subtle px-3 text-sm font-extrabold text-ink-muted">
                .{rootDomain}
              </span>
            </div>
          </Field>
          {availability ? (
            <p
              className={`-mt-2 animate-rise text-sm font-extrabold ${availability.ok ? 'text-success' : 'text-danger'}`}
              aria-live="polite"
            >
              {availability.message}
            </p>
          ) : null}
          {changingSubdomain ? (
            <div className="flex animate-rise flex-col gap-3 rounded-control border-2 border-sun-lip/40 bg-sun-soft p-4 text-sun-ink">
              <p className="flex items-start gap-2.5 font-bold">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2.5} />
                O endereço antigo deixará de funcionar imediatamente.
              </p>
              <label className="flex cursor-pointer items-center gap-3 font-extrabold">
                <input type="checkbox" name="confirmSubdomainChange" className="size-5 shrink-0 accent-go-strong" />
                Entendi que o link antigo vai parar de funcionar
              </label>
              {errors.confirmSubdomainChange ? (
                <p role="alert" className="text-sm font-bold text-danger">
                  {errors.confirmSubdomainChange}
                </p>
              ) : null}
            </div>
          ) : null}
        </ConfigBlock>

        <SaveBar>
          <FormMessage error={state.error} success={state.success} />
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full lg:w-auto lg:self-start">
            {pending ? <Spinner /> : null}
            Salvar configurações
          </Button>
        </SaveBar>
      </form>
      <UnsavedChangesGuard formId="settings-form" />
    </>
  )
}

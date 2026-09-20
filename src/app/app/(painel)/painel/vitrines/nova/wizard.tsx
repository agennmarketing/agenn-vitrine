'use client'

import { ArrowLeft, ArrowRight, Crown, Moon, Sun, X } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/submit-button'
import { TypeIcon } from '@/components/ui/type-icon'
import { createVitrineAction } from '@/features/vitrines/actions'
import { fetchAvailability } from '@/lib/forms/availability'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

const STEPS = [
  { label: 'Tipo', question: 'Qual é o seu negócio?', help: 'Isso define o botão e o jeito da vitrine. Não dá para trocar depois.' },
  { label: 'Nome e endereço', question: 'Como a vitrine vai se chamar?', help: 'O endereço é o link que você vai divulgar.' },
  { label: 'WhatsApp', question: 'Para onde vão os pedidos?', help: 'Os pedidos chegam prontos neste WhatsApp.' },
  { label: 'Aparência', question: 'Clara ou escura?', help: 'Dá para trocar quando quiser, em Aparência.' },
] as const

const TYPES = [
  ['produtos', 'Produtos', 'Lojas e catálogos. Botão "Solicitar orçamento".'],
  ['servicos', 'Serviços', 'Profissionais e clínicas. Botão "Agendar".'],
] as const

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
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    // data-focus-mode: o layout do painel esconde cabeçalho e navegação enquanto a trilha está aberta.
    <div data-focus-mode="" className="mx-auto flex w-full max-w-xl flex-col gap-7 pt-2 sm:pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/painel"
          aria-label="Cancelar e voltar para Minhas vitrines"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
        >
          <X aria-hidden="true" className="size-6" strokeWidth={3} />
        </Link>
        <ProgressBar value={step + 1} max={STEPS.length} label="Progresso da nova vitrine" />
        <p className="numeric shrink-0 text-sm font-extrabold text-go-strong">
          Passo {step + 1} de {STEPS.length}
          <span className="sr-only"> · {current.label}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h1 key={step} className="animate-rise text-[1.75rem] font-black leading-[1.1] tracking-[-0.025em] sm:text-[2rem]">
          {current.question}
        </h1>
        <p className="font-semibold text-ink-muted">{current.help}</p>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-7">
        <fieldset hidden={step !== 0} className="flex flex-col gap-3.5">
          <legend className="sr-only">Que tipo de vitrine?</legend>
          {TYPES.map(([value, label, hint]) => (
            <ChoiceCard
              key={value}
              name="type"
              value={value}
              defaultChecked={values.type === value}
              aria-label={label}
              title={label}
              description={hint}
              icon={<TypeIcon type={value} />}
            />
          ))}
          <FormMessage error={errors.type} />
        </fieldset>

        <fieldset hidden={step !== 1} className="flex flex-col gap-5">
          <legend className="sr-only">Nome e endereço</legend>
          <Field label="Nome da vitrine" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={values.name}
              maxLength={60}
              placeholder="Ex.: Loja da Ana"
              invalid={!!errors.name}
            />
          </Field>
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
                placeholder="lojadaana"
                invalid={!!errors.subdomain}
                className="rounded-none border-0 bg-transparent"
                onChange={(event) => onSubdomainChange(event.target.value)}
              />
              <span className="flex shrink-0 items-center bg-subtle px-3 text-sm font-extrabold text-ink-muted">.{rootDomain}</span>
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
        </fieldset>

        <fieldset hidden={step !== 2} className="flex flex-col gap-5">
          <legend className="sr-only">WhatsApp</legend>
          <Field label="WhatsApp" htmlFor="whatsappPhone" error={errors.whatsappPhone}>
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
          <Field label="Nome do contato" htmlFor="whatsappLabel" error={errors.whatsappLabel} hint="Aparece só para você. Ex.: Balcão, Atendimento.">
            <Input id="whatsappLabel" name="whatsappLabel" placeholder="Principal" defaultValue={values.whatsappLabel} />
          </Field>
        </fieldset>

        <fieldset hidden={step !== 3} className="flex flex-col gap-3.5">
          <legend className="sr-only">Tema</legend>
          <div className="grid grid-cols-2 gap-3.5">
            {(
              [
                ['light', 'Claro', Sun, 'bg-white', 'bg-[#e9ece8]'],
                ['dark', 'Escuro', Moon, 'bg-[#0e1411]', 'bg-[#2c362f]'],
              ] as const
            ).map(([value, label, Icon, ground, bar]) => (
              <ChoiceCard
                key={value}
                name="theme"
                value={value}
                defaultChecked={(values.theme || 'light') === value}
                aria-label={label}
                layout="stack"
                title={
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={2.5} />
                    {label}
                  </span>
                }
                icon={
                  <span aria-hidden="true" className={`flex h-24 flex-col gap-1.5 rounded-control border-2 border-line p-2.5 ${ground}`}>
                    <span className={`h-9 rounded-md ${bar}`} />
                    <span className="flex gap-1.5">
                      <span className={`h-6 flex-1 rounded-md ${bar}`} />
                      <span className={`h-6 flex-1 rounded-md ${bar}`} />
                    </span>
                  </span>
                }
              />
            ))}
          </div>
          <p className="flex items-start gap-2.5 rounded-control bg-sun-soft px-4 py-3 text-sm font-bold text-sun-ink">
            <Crown aria-hidden="true" className="mt-px size-[1.125rem] shrink-0" strokeWidth={2.5} />
            <span>
              <span className="font-black">Logo, cor da marca e banner</span> · Pro. Disponível no plano Pro.
            </span>
          </p>
        </fieldset>

        <FormMessage error={state.error} />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="sm:w-auto">
              <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={3} />
              Voltar
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          {/* Chaves diferentes: sem elas o React reaproveita o mesmo <button> e o troca
              para submit durante o clique em Continuar, enviando o formulário antes da hora. */}
          {!last ? (
            <Button key="next" size="lg" className="w-full sm:w-auto sm:min-w-48" onClick={() => setStep(step + 1)}>
              Continuar
              <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />
            </Button>
          ) : (
            <Button key="submit" type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:min-w-48">
              {pending ? <Spinner /> : null}
              Criar vitrine
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

'use client'

import { ArrowLeft, ArrowRight, Brush, CalendarClock, Eye, Hand, Moon, Scissors, ShoppingBag, Sparkles, Store, Sun, X } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { BusinessHoursEditor } from '@/components/ui/business-hours-editor'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/submit-button'
import { createVitrineAction } from '@/features/vitrines/actions'
import { fetchAvailability } from '@/lib/forms/availability'
import { initialFormState, type FormState } from '@/lib/forms/form-state'
import {
  DEFAULT_BUSINESS_HOURS,
  isServiceSegment,
  SEGMENT_COPY,
  SERVICE_SEGMENTS,
  type BusinessHours,
  type ServiceSegment,
} from '@/lib/vitrines/service-segments'
import { WIZARD_TYPE_COPY, WIZARD_VITRINE_TYPES } from '@/lib/vitrines/vitrine-types'

/*
 * A trilha começa pelo tipo da vitrine. Serviços continua igual (segmento do negócio,
 * horários de atendimento); produtos pula esses dois passos, que só existem para quem
 * trabalha com hora marcada.
 */
type StepKey = 'tipo' | 'segmento' | 'negocio' | 'contato' | 'final'

const SERVICE_STEPS: StepKey[] = ['tipo', 'segmento', 'negocio', 'contato', 'final']
const PRODUCT_STEPS: StepKey[] = ['tipo', 'negocio', 'contato', 'final']

const STEP_COPY: Record<StepKey, { label: string; question: string; help: string }> = {
  tipo: {
    label: 'Tipo de vitrine',
    question: 'Que tipo de vitrine você quer criar?',
    help: 'É isso que define como o cliente compra: marcando um horário ou pedindo um produto.',
  },
  segmento: { label: 'Tipo de negócio', question: 'Qual é o seu tipo de negócio?', help: 'Assim a vitrine já vem com exemplos do seu ramo.' },
  negocio: { label: 'Seu negócio', question: 'Como o seu negócio se chama?', help: 'O endereço é o link que você vai divulgar para os clientes.' },
  contato: { label: 'Contato', question: 'Para onde vão as solicitações?', help: 'É por este WhatsApp que o cliente fala com você.' },
  final: { label: 'Horários e aparência', question: 'Quando você atende?', help: 'Os horários livres para agendar saem daqui. Dá para mudar depois, na Agenda.' },
}

const PRODUCT_FINAL = { label: 'Aparência', question: 'Como a vitrine vai aparecer?', help: 'Escolha o tema; o resto você ajusta depois.' }

const TYPE_ICON: Record<(typeof WIZARD_VITRINE_TYPES)[number], typeof Scissors> = {
  servicos: CalendarClock,
  produtos: ShoppingBag,
}

// Mesmo quadrado do SegmentIcon, com o ícone do tipo de vitrine.
function TypeIcon({ type }: { type: (typeof WIZARD_VITRINE_TYPES)[number] }) {
  const Icon = TYPE_ICON[type]
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-control bg-go-strong text-white shadow-[0_3px_0_var(--lip)] [--lip:var(--color-go-lip)]"
    >
      <Icon className="size-6" strokeWidth={2.5} />
    </span>
  )
}

const SEGMENT_ICON: Record<ServiceSegment, typeof Scissors> = {
  nail: Hand,
  cabelo: Scissors,
  lash: Eye,
  sobrancelha: Brush,
  barbearia: Scissors,
  estetica: Sparkles,
  outro: Store,
}

// Mesmo quadrado do TypeIcon, com o ícone do ramo.
function SegmentIcon({ segment }: { segment: ServiceSegment }) {
  const Icon = SEGMENT_ICON[segment]
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-control bg-go-strong text-white shadow-[0_3px_0_var(--lip)] [--lip:var(--color-go-lip)]"
    >
      <Icon className="size-6" strokeWidth={2.5} />
    </span>
  )
}

function stepKeyForErrors(errors: FormState['fieldErrors']): StepKey | null {
  if (!errors) return null
  if (errors.type) return 'tipo'
  if (errors.serviceSegment) return 'segmento'
  if (errors.name || errors.subdomain) return 'negocio'
  if (errors.whatsappPhone || errors.whatsappLabel || errors.instagram || errors.address) return 'contato'
  return 'final'
}

export function VitrineWizard({ rootDomain }: { rootDomain: string }) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<(typeof WIZARD_VITRINE_TYPES)[number]>('servicos')
  const [segment, setSegment] = useState<ServiceSegment | null>(null)
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS)
  const steps = type === 'servicos' ? SERVICE_STEPS : PRODUCT_STEPS
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await createVitrineAction(prev, formData)
    const errorKey = stepKeyForErrors(result.fieldErrors)
    const errorStep = errorKey ? steps.indexOf(errorKey) : -1
    if (errorStep >= 0) setStep(errorStep)
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
  const chosenSegment = segment ?? (isServiceSegment(values.serviceSegment) ? values.serviceSegment : null)
  const copy = SEGMENT_COPY[chosenSegment ?? 'outro']
  const stepKey = steps[step]
  const current = stepKey === 'final' && type === 'produtos' ? PRODUCT_FINAL : STEP_COPY[stepKey]
  const last = step === steps.length - 1

  return (
    // data-focus-mode: o layout do painel esconde cabeçalho e navegação enquanto a trilha está aberta.
    <div data-focus-mode="" className="mx-auto flex w-full max-w-xl flex-col gap-7 pt-2 sm:pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/painel"
          aria-label="Cancelar e voltar ao painel"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
        >
          <X aria-hidden="true" className="size-6" strokeWidth={3} />
        </Link>
        <ProgressBar value={step + 1} max={steps.length} label="Progresso da nova vitrine" />
        <p className="numeric shrink-0 text-sm font-extrabold text-go-strong">
          Passo {step + 1} de {steps.length}
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
        <fieldset hidden={stepKey !== 'tipo'} className="flex flex-col gap-3.5">
          <legend className="sr-only">Tipo de vitrine</legend>
          {WIZARD_VITRINE_TYPES.map((value) => (
            <ChoiceCard
              key={value}
              name="type"
              value={value}
              checked={type === value}
              onChange={() => {
                setType(value)
                setStep(0)
              }}
              aria-label={WIZARD_TYPE_COPY[value].title}
              title={WIZARD_TYPE_COPY[value].title}
              description={WIZARD_TYPE_COPY[value].description}
              icon={<TypeIcon type={value} />}
            />
          ))}
          <FormMessage error={errors.type} />
        </fieldset>

        <fieldset hidden={stepKey !== 'segmento'} className="flex flex-col gap-3.5">
          <legend className="sr-only">Tipo de negócio</legend>
          {SERVICE_SEGMENTS.map((value) => (
            <ChoiceCard
              key={value}
              name="serviceSegment"
              value={value}
              defaultChecked={values.serviceSegment === value}
              onChange={() => setSegment(value)}
              aria-label={SEGMENT_COPY[value].label}
              title={SEGMENT_COPY[value].label}
              icon={<SegmentIcon segment={value} />}
            />
          ))}
          <FormMessage error={errors.serviceSegment} />
        </fieldset>

        <fieldset hidden={stepKey !== 'negocio'} className="flex flex-col gap-5">
          <legend className="sr-only">Seu negócio</legend>
          <Field label="Nome do negócio" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={values.name}
              maxLength={60}
              placeholder={`Ex.: ${copy.businessName}`}
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
                placeholder={copy.subdomain}
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

        <fieldset hidden={stepKey !== 'contato'} className="flex flex-col gap-5">
          <legend className="sr-only">Contato</legend>
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
                placeholder={copy.subdomain}
                invalid={!!errors.instagram}
                className="rounded-none border-0 bg-transparent"
              />
            </div>
          </Field>
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
        </fieldset>

        <fieldset hidden={stepKey !== 'final' || type !== 'servicos'} className="flex flex-col gap-3.5">
          <legend className="sr-only">Horários de atendimento</legend>
          <input type="hidden" name="businessHours" value={JSON.stringify(hours)} />
          <BusinessHoursEditor hours={hours} onChange={setHours} />
          <FormMessage error={errors.businessHours} />
        </fieldset>

        <fieldset hidden={stepKey !== 'final'} className="flex flex-col gap-3.5">
          <legend className="mb-1 text-lg font-black text-ink">Aparência: clara ou escura?</legend>
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
          <p className="flex items-start gap-2.5 rounded-control bg-go-soft px-4 py-3 text-sm font-bold text-go-strong">
            <Brush aria-hidden="true" className="mt-px size-[1.125rem] shrink-0" strokeWidth={2.5} />
            <span>
              <span className="font-black">Logo, cor da marca e banner</span> você escolhe depois, em Aparência.
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

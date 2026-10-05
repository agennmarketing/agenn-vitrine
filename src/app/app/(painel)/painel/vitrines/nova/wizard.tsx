'use client'

import { ArrowLeft, ArrowRight, Brush, CalendarClock, Eye, Hand, Link2, Moon, Scissors, ShoppingBag, Sparkles, Store, Sun } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { BusinessHoursEditor } from '@/components/ui/business-hours-editor'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { ProgressBar } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/submit-button'
import { createVitrineAction } from '@/features/vitrines/actions'
import { AVAILABILITY_ERROR_MESSAGE, fetchAvailability } from '@/lib/forms/availability'
import { filterSubdomainField } from '@/lib/forms/subdomain-field'
import { initialFormState, type FormState } from '@/lib/forms/form-state'
import {
  DEFAULT_BUSINESS_HOURS,
  isServiceSegment,
  SEGMENT_COPY,
  SERVICE_SEGMENTS,
  type BusinessHours,
  type ServiceSegment,
} from '@/lib/vitrines/service-segments'
import { PRODUCT_MODE_COPY, PRODUCT_MODES, WIZARD_TYPE_COPY, WIZARD_VITRINE_TYPES, type ProductMode } from '@/lib/vitrines/vitrine-types'
import type { WizardPreset } from '@/lib/vitrines/wizard-preset'

/*
 * A trilha começa pelo tipo da vitrine. Serviços continua igual (segmento do negócio,
 * horários de atendimento); produtos pula esses dois passos, que só existem para quem
 * trabalha com hora marcada, e pergunta como vende: produtos próprios ou afiliado.
 */
type StepKey = 'tipo' | 'venda' | 'segmento' | 'negocio' | 'contato' | 'final'

const SERVICE_STEPS: StepKey[] = ['tipo', 'segmento', 'negocio', 'contato', 'final']
const PRODUCT_STEPS: StepKey[] = ['tipo', 'venda', 'negocio', 'contato', 'final']

const STEP_COPY: Record<StepKey, { label: string; question: string; help: string }> = {
  tipo: {
    label: 'Tipo de vitrine',
    question: 'Que tipo de vitrine você quer criar?',
    help: 'É isso que define como o cliente compra: marcando um horário ou pedindo um produto.',
  },
  venda: {
    label: 'Como você vende',
    question: 'Como você vende seus produtos?',
    help: 'Isso define o que acontece quando o cliente toca em comprar.',
  },
  segmento: { label: 'Tipo de negócio', question: 'Qual é o seu tipo de negócio?', help: 'Assim a vitrine já vem com exemplos do seu ramo.' },
  negocio: { label: 'Seu negócio', question: 'Como o seu negócio se chama?', help: 'O endereço é o link que você vai divulgar para os clientes.' },
  contato: { label: 'Contato', question: 'Para onde vão as solicitações?', help: 'É por este WhatsApp que o cliente fala com você.' },
  final: { label: 'Horários e aparência', question: 'Quando você atende?', help: 'Os horários livres para agendar saem daqui. Dá para mudar depois, na Agenda.' },
}

const PRODUCT_FINAL = { label: 'Aparência', question: 'Como a vitrine vai aparecer?', help: 'Escolha o tema; o resto você ajusta depois.' }

// Afiliado não tem WhatsApp nem endereço: o passo de contato fica só com o Instagram.
const AFFILIATE_CONTACT = { label: 'Redes', question: 'Onde as pessoas te encontram?', help: 'Seu Instagram aparece na vitrine. É opcional.' }

const MODE_ICON: Record<ProductMode, typeof Scissors> = {
  proprios: ShoppingBag,
  afiliado: Link2,
}

const TYPE_ICON: Record<(typeof WIZARD_VITRINE_TYPES)[number], typeof Scissors> = {
  servicos: CalendarClock,
  produtos: ShoppingBag,
}

// Mesmo quadrado do SegmentIcon, com o ícone do tipo de vitrine.
function TypeIcon({ Icon }: { Icon: typeof Scissors }) {
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
  if (errors.productMode) return 'venda'
  if (errors.serviceSegment) return 'segmento'
  if (errors.name || errors.subdomain) return 'negocio'
  if (errors.whatsappPhone || errors.whatsappLabel || errors.instagram || errors.address) return 'contato'
  return 'final'
}

// preset: quem veio da página de um negócio já tem o tipo e o ramo (ou o jeito de vender)
// escolhidos, então começa no passo do nome; dá para voltar e trocar.
export function VitrineWizard({ rootDomain, preset }: { rootDomain: string; preset: WizardPreset | null }) {
  const [step, setStep] = useState(() => (preset ? (preset.type === 'servicos' ? SERVICE_STEPS : PRODUCT_STEPS).indexOf('negocio') : 0))
  const [type, setType] = useState<(typeof WIZARD_VITRINE_TYPES)[number]>(preset?.type ?? 'servicos')
  const [productMode, setProductMode] = useState<ProductMode>(preset?.type === 'produtos' ? preset.productMode : 'proprios')
  const affiliate = type === 'produtos' && productMode === 'afiliado'
  const [segment, setSegment] = useState<ServiceSegment | null>(preset?.type === 'servicos' ? preset.segment : null)
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

  /*
   * O passo do endereço só avança com nome e um endereço livre: ocupado ou inválido
   * prende a pessoa ali, em vez de só reclamar no final. Se a checagem ainda não
   * voltou, confere na hora; se ela falhar (rede), deixa seguir e o servidor confere ao criar.
   */
  const formRef = useRef<HTMLFormElement>(null)
  const [stepErrors, setStepErrors] = useState<{ name?: string; subdomain?: string }>({})
  const [checking, setChecking] = useState(false)
  const clearStepError = (key: 'name' | 'subdomain') =>
    setStepErrors((current) => {
      const rest = { ...current }
      delete rest[key]
      return rest
    })
  async function goNext() {
    if (stepKey !== 'negocio') return setStep(step + 1)
    const form = formRef.current
    const data = new FormData(form ?? undefined)
    const name = String(data.get('name') ?? '').trim()
    const subdomain = String(data.get('subdomain') ?? '').trim()
    const found: { name?: string; subdomain?: string } = {}
    if (!name) found.name = 'Informe o nome do negócio.'
    let result = availability
    if (!subdomain) found.subdomain = 'Escolha o endereço da vitrine.'
    else if (!result) {
      clearTimeout(timer.current)
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      setChecking(true)
      result = await fetchAvailability(`/api/disponibilidade/subdominio?valor=${encodeURIComponent(subdomain)}`, controller.signal)
      setChecking(false)
      if (result) setAvailability(result)
    }
    if (subdomain && result && !result.ok && result.message !== AVAILABILITY_ERROR_MESSAGE) found.subdomain = result.message
    setStepErrors(found)
    if (found.name || found.subdomain) {
      form?.querySelector<HTMLInputElement>(found.name ? '#name' : '#subdomain')?.focus()
      return
    }
    setStep(step + 1)
  }

  const errors: Record<string, string | undefined> = { ...state.fieldErrors, ...stepErrors }
  const values = state.values ?? {}
  const chosenSegment = segment ?? (isServiceSegment(values.serviceSegment) ? values.serviceSegment : null)
  const copy = SEGMENT_COPY[chosenSegment ?? 'outro']
  const stepKey = steps[step]
  const current =
    stepKey === 'final' && type === 'produtos'
      ? PRODUCT_FINAL
      : stepKey === 'contato' && affiliate
        ? AFFILIATE_CONTACT
        : STEP_COPY[stepKey]
  const last = step === steps.length - 1

  return (
    // data-focus-mode: o layout do painel esconde cabeçalho e navegação enquanto a trilha está aberta.
    <div data-focus-mode="" className="mx-auto flex w-full max-w-xl flex-col gap-7 pt-2 sm:pt-6">
      <div className="flex items-center gap-3">
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

      <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-7">
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
              icon={<TypeIcon Icon={TYPE_ICON[value]} />}
            />
          ))}
          <FormMessage error={errors.type} />
        </fieldset>

        <fieldset hidden={stepKey !== 'venda'} className="flex flex-col gap-3.5">
          <legend className="sr-only">Como você vende</legend>
          {PRODUCT_MODES.map((value) => (
            <ChoiceCard
              key={value}
              name="productMode"
              value={value}
              checked={productMode === value}
              onChange={() => setProductMode(value)}
              aria-label={PRODUCT_MODE_COPY[value].title}
              title={PRODUCT_MODE_COPY[value].title}
              description={PRODUCT_MODE_COPY[value].description}
              icon={<TypeIcon Icon={MODE_ICON[value]} />}
            />
          ))}
          <FormMessage error={errors.productMode} />
        </fieldset>

        <fieldset hidden={stepKey !== 'segmento'} className="flex flex-col gap-3.5">
          <legend className="sr-only">Tipo de negócio</legend>
          {SERVICE_SEGMENTS.map((value) => (
            <ChoiceCard
              key={value}
              name="serviceSegment"
              value={value}
              defaultChecked={chosenSegment === value}
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
              onChange={() => clearStepError('name')}
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
                onChange={(event) => {
                  clearStepError('subdomain')
                  onSubdomainChange(filterSubdomainField(event.target))
                }}
              />
              <span className="flex shrink-0 items-center bg-subtle px-3 text-sm font-extrabold text-ink-muted">.{rootDomain}</span>
            </div>
          </Field>
          {/* Com o erro no campo, a mesma frase não se repete aqui embaixo. */}
          {availability && !errors.subdomain ? (
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
          <div hidden={affiliate}>
            <Field label="WhatsApp" htmlFor="whatsappPhone" error={errors.whatsappPhone}>
              <MaskedInput
                mask="phone"
                id="whatsappPhone"
                name="whatsappPhone"
                placeholder="(11) 98765-4321"
                defaultValue={values.whatsappPhone}
                invalid={!!errors.whatsappPhone}
              />
            </Field>
          </div>
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
          <div hidden={affiliate}>
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
          </div>
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
            <Button key="next" size="lg" disabled={checking} aria-busy={checking} className="w-full sm:w-auto sm:min-w-48" onClick={goNext}>
              {checking ? <Spinner /> : null}
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

'use client'

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FolderPlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress'
import { DragHandle, SortableItem, SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/submit-button'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { saveItemAction } from '@/features/items/actions'
import type { getItemForEdit } from '@/features/items/queries'
import { normalizeItemCode } from '@/lib/codes/item-code'
import { fetchAvailability } from '@/lib/forms/availability'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput } from '@/lib/money/money'
import { isServiceSegment, SEGMENT_COPY } from '@/lib/vitrines/service-segments'
import { useCloseItemDialog } from './item-dialog'

type ItemForEdit = Awaited<ReturnType<typeof getItemForEdit>>
type Slot = { id: string; url: string } | null
type VariationRow = { key: string; id: string | null; name: string; price: string; promoPrice: string; soldOut: boolean }

const CHOICE_CARD =
  'pressable relative flex h-12 cursor-pointer items-center justify-center rounded-control border-2 border-line-strong bg-surface px-2 text-center text-sm font-extrabold leading-tight text-ink [--lip:var(--color-line-strong)] hover:bg-canvas has-[:checked]:border-go has-[:checked]:bg-go-soft has-[:checked]:text-go-strong has-[:checked]:[--lip:var(--color-go)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong'

const ADVANCED_FIELDS = ['whatsappId', 'buttonText', 'customMessage']
const PRICE_TYPES = [
  ['fixed', 'Preço fixo'],
  ['from', 'A partir de'],
  ['on_request', 'Sob consulta'],
] as const

// Os passos do popup, no molde da criação de vitrine: uma pergunta por tela.
// Vitrine de produtos: o produto tem um preço só, e as variações são tamanho ou cor.
// Vitrine de serviços: o mesmo cadastro, falando de serviço e com duração.
function steps(produto: boolean, servico: boolean) {
  return [
    {
      label: 'Fotos',
      question: produto ? 'Mostre o seu produto' : servico ? 'Mostre o seu serviço' : 'Mostre o seu item',
      help: 'A capa é a foto que aparece na vitrine. As outras duas fotos são opcionais.',
    },
    {
      label: 'Detalhes',
      question: 'Como ele se chama?',
      help: servico
        ? 'Nome, descrição, categoria e quanto tempo o serviço leva.'
        : 'Nome, descrição e a categoria em que ele aparece na vitrine.',
    },
    {
      label: 'Preço',
      question: 'Quanto custa?',
      help: produto
        ? 'O preço do produto. Variações, como tamanho ou cor, são opcionais.'
        : servico
          ? 'Preço fixo, a partir de ou sob consulta. Variações, como pacotes, são opcionais.'
          : 'Escolha o tipo de preço. Variações, como tamanhos ou modelos, são opcionais.',
    },
    { label: 'Extras', question: 'Algo a mais?', help: 'Tudo aqui é opcional: WhatsApp do item, texto do botão e mensagem.' },
  ]
}
const STEP_COUNT = 4

// Campo com erro → passo onde ele mora (o popup volta para lá depois de salvar com erro).
const STEP_FIELDS: string[][] = [
  ['coverMediaId', 'galleryMediaIds', 'videoMediaId'],
  ['name', 'description', 'categoryId', 'code', 'durationMinutes', 'notice', 'tags'],
  ['saleMode', 'externalUrl', 'priceType', 'price', 'promoPrice', 'soldOut', 'variations'],
  [...ADVANCED_FIELDS],
]

function stepForErrors(errors: FormState['fieldErrors']): number | null {
  if (!errors) return null
  const index = STEP_FIELDS.findIndex((fields) => fields.some((field) => errors[field]))
  return index >= 0 ? index : null
}

function newKey() {
  return Math.random().toString(36).slice(2)
}

// Grupo dentro de um passo: título curto (opcional), apoio e o conteúdo.
function FormSection({ title, description, children }: { title?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5">
      {title ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-black leading-snug tracking-[-0.02em] text-ink">{title}</h3>
          {description ? <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

// Campo de dinheiro com "R$" fixo à esquerda.
function MoneyInput(props: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-ink-muted">
        R$
      </span>
      <Input inputMode="decimal" {...props} className={`pl-11 numeric ${props.className ?? ''}`} />
    </div>
  )
}

function CloseButton() {
  const close = useCloseItemDialog()
  return (
    <button
      type="button"
      aria-label="Fechar"
      title="Fechar"
      onClick={close}
      className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
    >
      <X aria-hidden="true" className="size-6" strokeWidth={3} />
    </button>
  )
}

// Cabeçalho do popup: fechar, a barra de progresso e os passos (tocar num passo leva direto a ele).
function DialogHeader({ step, labels, onStep }: { step: number; labels: string[]; onStep: (step: number) => void }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line bg-surface px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
      <div className="flex items-center gap-3">
        <CloseButton />
        <ProgressBar value={step + 1} max={STEP_COUNT} label="Progresso do item" />
        <p className="numeric shrink-0 text-sm font-extrabold text-go-strong">
          Passo {step + 1} de {STEP_COUNT}
        </p>
      </div>
      <nav aria-label="Passos do item">
        <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {labels.map((label, index) => {
            const current = index === step
            const done = index < step
            const tone = current
              ? 'border-go-strong bg-surface text-go-strong'
              : done
                ? 'border-go/40 bg-go-soft text-go-strong hover:border-go'
                : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
            return (
              <li key={label}>
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onStep(index)}
                  className={`flex h-10 w-full items-center justify-center gap-1 rounded-full border-2 px-1.5 text-[0.8125rem] font-extrabold transition-colors duration-150 ease-out-quint sm:gap-1.5 sm:text-sm ${tone}`}
                >
                  {done ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={3.5} /> : null}
                  {label}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </header>
  )
}

// Popup aberto sem categoria: o item precisa de uma antes de existir.
export function NoCategoryStep() {
  const close = useCloseItemDialog()
  return (
    <>
      <div className="flex items-center px-4 pt-3 sm:px-6 sm:pt-5">
        <CloseButton />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-12 text-center">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-card bg-go-soft text-go-strong shadow-[0_4px_0_var(--color-go)]"
        >
          <FolderPlus className="size-8" strokeWidth={2.5} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black tracking-[-0.025em] text-ink">Crie uma categoria antes de cadastrar itens.</h2>
          <p className="mx-auto max-w-sm font-semibold text-ink-muted">
            As categorias organizam a vitrine. Por exemplo: Destaques, Novidades, Promoções.
          </p>
        </div>
        <Button size="lg" className="w-full max-w-xs" onClick={close}>
          Voltar para os itens
        </Button>
      </div>
    </>
  )
}

export function ItemForm(props: {
  vitrineId: string
  vitrineType: string
  serviceSegment?: string | null
  defaultButtonText: string
  categories: { id: string; name: string }[]
  contacts: { id: string; label: string }[]
  nextCode: string
  item?: ItemForEdit
}) {
  const { vitrineId, item } = props
  // Produtos: preço fixo, sem duração e sem etiquetas — só o que a spec do produto pede.
  const produto = props.vitrineType === 'produtos'
  const servico = props.vitrineType === 'servicos'
  const stepList = steps(produto, servico)
  // O segmento do negócio só troca o exemplo do nome do serviço.
  const serviceExample = isServiceSegment(props.serviceSegment) ? SEGMENT_COPY[props.serviceSegment].serviceExample : 'Corte de cabelo'
  const [step, setStep] = useState(0)
  const [coverId, setCoverId] = useState<string>(item?.cover?.id ?? '')
  // Vídeo saiu do cadastro; um vídeo que o item já tenha continua ligado a ele.
  const videoId = item?.video?.id ?? ''
  const [galleryIds, setGalleryIds] = useState<(string | null)[]>([item?.gallery[0]?.id ?? null, item?.gallery[1]?.id ?? null])
  const [priceType, setPriceType] = useState<string>(produto ? 'fixed' : (item?.price_type ?? 'fixed'))
  const [saleMode, setSaleMode] = useState<string>(item?.sale_mode ?? 'whatsapp')
  const [variations, setVariations] = useState<VariationRow[]>(
    (item?.variations ?? []).map((v) => ({
      key: v.id,
      id: v.id,
      name: v.name,
      price: centsToInput(v.price_cents),
      promoPrice: centsToInput(v.promo_price_cents),
      soldOut: v.sold_out,
    })),
  )
  const [codeEdited, setCodeEdited] = useState(false)
  const [codeCheck, setCodeCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef<AbortController>(undefined)
  const advancedRef = useRef<HTMLDetailsElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inFlight.current?.abort()
    },
    [],
  )

  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveItemAction(vitrineId, item?.id ?? null, prev, formData)
    const errorStep = stepForErrors(result.fieldErrors)
    if (errorStep !== null) goTo(errorStep)
    if (result.fieldErrors && ADVANCED_FIELDS.some((field) => result.fieldErrors?.[field]) && advancedRef.current) {
      advancedRef.current.open = true
    }
    return result
  }, {})

  const errors = state.fieldErrors ?? {}
  const values = state.values

  // Troca de passo: a rolagem do popup volta ao topo, para a pergunta nova ficar à vista.
  function goTo(next: number) {
    setStep(next)
    bodyRef.current?.scrollTo({ top: 0 })
  }

  function onCodeChange(raw: string) {
    setCodeEdited(true)
    setCodeCheck(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    const value = normalizeItemCode(raw)
    if (!value || value === item?.code) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const query = item?.id ? `&item=${item.id}` : ''
      const result = await fetchAvailability(
        `/api/disponibilidade/codigo?valor=${encodeURIComponent(value)}${query}`,
        controller.signal,
      )
      if (result) setCodeCheck(result)
    }, 400)
  }

  // Reordenar não dispara "input" no formulário; avisa o guarda de alterações não salvas.
  function markDirty() {
    document.getElementById('item-form')?.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function updateVariation(key: string, patch: Partial<VariationRow>) {
    setVariations((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const showPrices = priceType !== 'on_request'
  const initialCode = item?.code ?? props.nextCode
  const inactive = values ? values.soldOut === 'on' : (item?.sold_out ?? false)
  const current = stepList[step]
  const last = step === STEP_COUNT - 1

  return (
    <>
      <DialogHeader step={step} labels={stepList.map((entry) => entry.label)} onStep={goTo} />

      <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-2">
            <h2 key={step} className="animate-rise text-[1.625rem] font-black leading-[1.1] tracking-[-0.025em] text-ink sm:text-[1.875rem]">
              {current.question}
            </h2>
            <p className="font-semibold text-ink-muted">{current.help}</p>
          </div>

          {/* Passo 1: fotos (os envios acontecem na hora, fora do formulário). */}
          <div hidden={step !== 0} className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 row-span-2 flex [&>div]:w-full">
                <ImageSlot
                  label="Capa"
                  role="cover"
                  vitrineId={vitrineId}
                  itemId={item?.id}
                  initial={item?.cover ?? null}
                  onChange={(media) => setCoverId(media?.id ?? '')}
                />
              </div>
              {([1, 2] as const).map((position) => (
                <ImageSlot
                  key={position}
                  label={`Imagem ${position + 1}`}
                  role="gallery"
                  position={position}
                  vitrineId={vitrineId}
                  itemId={item?.id}
                  initial={(item?.gallery[position - 1] as Slot) ?? null}
                  removable
                  onChange={(media) =>
                    setGalleryIds((ids) => ids.map((id, index) => (index === position - 1 ? (media?.id ?? null) : id)))
                  }
                />
              ))}
            </div>
            {errors.coverMediaId ? (
              <p role="alert" className="-mt-2 flex animate-rise items-start gap-1.5 text-sm font-bold leading-5 text-danger">
                <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
                <span>{errors.coverMediaId}</span>
              </p>
            ) : null}
          </div>

          <form id="item-form" action={formAction} noValidate className="flex flex-col gap-7">
            <input type="hidden" name="coverMediaId" value={coverId} />
            <input type="hidden" name="galleryMediaIds" value={JSON.stringify(galleryIds.filter(Boolean))} />
            <input type="hidden" name="videoMediaId" value={videoId} />
            <input
              type="hidden"
              name="variations"
              value={JSON.stringify(
                variations.map((row) => ({
                  id: row.id,
                  name: row.name,
                  price: row.price,
                  promoPrice: row.promoPrice,
                  soldOut: row.soldOut,
                })),
              )}
            />
            {item ? null : <input type="hidden" name="codeAuto" value={codeEdited ? '0' : '1'} />}

            {/* Passo 2: nome, descrição, categoria e código. */}
            <div hidden={step !== 1}>
              <FormSection>
                <Field label="Nome" htmlFor="name" error={errors.name}>
                  <Input
                    id="name"
                    name="name"
                    maxLength={80}
                    placeholder={produto ? 'Ex.: Camiseta básica' : `Ex.: ${serviceExample}`}
                    defaultValue={values?.name ?? item?.name ?? ''}
                    invalid={!!errors.name}
                  />
                </Field>
                <Field label="Descrição" htmlFor="description" error={errors.description}>
                  <Textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={1000}
                    placeholder={produto ? 'Material, medidas, detalhes que ajudam a escolher.' : 'O que está incluído e detalhes que ajudam a escolher.'}
                    defaultValue={values?.description ?? item?.description ?? ''}
                    invalid={!!errors.description}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <Field label="Categoria" htmlFor="categoryId" error={errors.categoryId}>
                    <Select
                      id="categoryId"
                      name="categoryId"
                      defaultValue={values?.categoryId ?? item?.category_id ?? props.categories[0]?.id ?? ''}
                      invalid={!!errors.categoryId}
                    >
                      {props.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex flex-col gap-2">
                    <Field label="Código" htmlFor="code" error={errors.code}>
                      <Input
                        id="code"
                        name="code"
                        maxLength={6}
                        autoCapitalize="characters"
                        defaultValue={values?.code ?? initialCode}
                        invalid={!!errors.code}
                        className="font-extrabold uppercase tracking-[0.04em]"
                        onChange={(event) => onCodeChange(event.target.value)}
                      />
                    </Field>
                    {codeCheck ? (
                      <p
                        className={`flex items-start gap-1.5 text-sm font-bold leading-5 ${codeCheck.ok ? 'text-go-strong' : 'text-danger'}`}
                        aria-live="polite"
                      >
                        {codeCheck.ok ? (
                          <CircleCheck aria-hidden="true" className="mt-px size-4 shrink-0 animate-pop" strokeWidth={2.5} />
                        ) : (
                          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
                        )}
                        <span>{codeCheck.message}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                {servico ? (
                  <>
                  <Field
                    label="Duração (minutos)"
                    htmlFor="durationMinutes"
                    error={errors.durationMinutes}
                    hint="Quanto tempo o horário fica reservado na agenda."
                  >
                    <Input
                      id="durationMinutes"
                      name="durationMinutes"
                      inputMode="numeric"
                      placeholder="Ex.: 45"
                      defaultValue={values?.durationMinutes ?? (item?.duration_minutes ? String(item.duration_minutes) : '')}
                      invalid={!!errors.durationMinutes}
                      className="numeric sm:max-w-44"
                    />
                  </Field>
                  <Field
                    label="Aviso ao cliente"
                    htmlFor="notice"
                    error={errors.notice}
                    hint="Opcional. Aparece no serviço e na confirmação do agendamento."
                  >
                    <Textarea
                      id="notice"
                      name="notice"
                      rows={2}
                      maxLength={300}
                      placeholder="Ex.: Chegue 10 minutos antes."
                      defaultValue={values?.notice ?? item?.notice ?? ''}
                      invalid={!!errors.notice}
                    />
                  </Field>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="durationMinutes" value="" />
                    <input type="hidden" name="notice" value="" />
                  </>
                )}
                {produto ? (
                  <input type="hidden" name="tags" value="" />
                ) : (
                  <Field label="Etiquetas" htmlFor="tags" error={errors.tags} hint="Até 5, separadas por vírgula.">
                    <Input
                      id="tags"
                      name="tags"
                      placeholder="Ex.: novo, promoção"
                      defaultValue={values?.tags ?? (item?.tags ?? []).join(', ')}
                      invalid={!!errors.tags}
                    />
                  </Field>
                )}
              </FormSection>
            </div>

            {/* Passo 3: forma de venda (produtos), preço, esgotado e variações. */}
            <div hidden={step !== 2} className="flex flex-col gap-7">
              <FormSection>
                {produto ? (
                  <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="mb-2 text-[0.9375rem] font-extrabold leading-5 text-ink">Como o cliente compra</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['whatsapp', 'Pedido pelo WhatsApp'],
                          ['link', 'Link externo'],
                        ] as const
                      ).map(([value, label]) => (
                        <label key={value} className={CHOICE_CARD}>
                          <input
                            type="radio"
                            name="saleMode"
                            value={value}
                            checked={saleMode === value}
                            onChange={(event) => setSaleMode(event.target.value)}
                            className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-control opacity-0"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="text-sm font-semibold leading-5 text-ink-muted">
                      {saleMode === 'link'
                        ? 'O produto mostra "Comprar agora" e abre o site que você informar. Ele não entra na sacola.'
                        : 'O produto entra na sacola e o pedido vai para o seu WhatsApp.'}
                    </p>
                  </fieldset>
                ) : (
                  <input type="hidden" name="saleMode" value="whatsapp" />
                )}
                {produto && saleMode === 'link' ? (
                  <Field
                    label="Link do produto"
                    htmlFor="externalUrl"
                    error={errors.externalUrl}
                    hint="Mercado Livre, Shopee, seu site…"
                  >
                    <Input
                      id="externalUrl"
                      name="externalUrl"
                      type="url"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="https://..."
                      defaultValue={values?.externalUrl ?? item?.external_url ?? ''}
                      invalid={!!errors.externalUrl}
                    />
                  </Field>
                ) : (
                  <input type="hidden" name="externalUrl" value="" />
                )}
                {produto ? <input type="hidden" name="priceType" value="fixed" /> : null}
                <fieldset hidden={produto} className="flex min-w-0 flex-col gap-2">
                  <legend className="mb-2 text-[0.9375rem] font-extrabold leading-5 text-ink">Tipo de preço</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PRICE_TYPES.map(([value, label]) => (
                      <label
                        key={value}
                        className={CHOICE_CARD}
                      >
                        <input
                          type="radio"
                          name="priceType"
                          value={value}
                          checked={priceType === value}
                          onChange={(event) => setPriceType(event.target.value)}
                          className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-control opacity-0"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {errors.priceType ? (
                    <p className="flex items-start gap-1.5 text-sm font-bold leading-5 text-danger">
                      <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
                      <span>{errors.priceType}</span>
                    </p>
                  ) : null}
                </fieldset>

                <div hidden={!showPrices} className="grid gap-5 sm:grid-cols-2">
                  <Field label="Preço" htmlFor="price" error={errors.price}>
                    <MoneyInput
                      id="price"
                      name="price"
                      placeholder="49,90"
                      defaultValue={values?.price ?? centsToInput(item?.price_cents ?? null)}
                      invalid={!!errors.price}
                    />
                  </Field>
                  <Field label="Preço promocional" htmlFor="promoPrice" error={errors.promoPrice} hint="Opcional.">
                    <MoneyInput
                      id="promoPrice"
                      name="promoPrice"
                      defaultValue={values?.promoPrice ?? centsToInput(item?.promo_price_cents ?? null)}
                      invalid={!!errors.promoPrice}
                    />
                  </Field>
                </div>

                {produto || servico ? (
                  <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="mb-2 text-[0.9375rem] font-extrabold leading-5 text-ink">Disponibilidade</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([['', 'Ativo'], ['on', 'Inativo']] as const).map(([value, label]) => (
                        <label key={label} className={CHOICE_CARD}>
                          <input
                            type="radio"
                            name="soldOut"
                            value={value}
                            defaultChecked={inactive === (value === 'on')}
                            className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-control opacity-0"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="text-sm font-semibold leading-snug text-ink-muted">
                      {servico
                        ? 'Inativo: o serviço continua na vitrine, mas não pode ser agendado.'
                        : 'Inativo: o produto continua na vitrine, mas não pode ser adicionado à sacola.'}
                    </p>
                  </fieldset>
                ) : (
                <label className="group flex cursor-pointer items-center justify-between gap-4 rounded-control border-2 border-line bg-surface p-4 has-[:checked]:border-danger/40 has-[:checked]:bg-danger-soft/50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-extrabold text-ink">Esgotado</span>
                    <span className="text-sm font-semibold leading-snug text-ink-muted">
                      O item continua na vitrine, mas não pode ser pedido.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    name="soldOut"
                    defaultChecked={values ? values.soldOut === 'on' : item?.sold_out}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-line-strong bg-line transition-colors duration-200 ease-out-quint peer-checked:border-danger-lip peer-checked:bg-danger-fill"
                  >
                    <span className="block size-6 translate-x-0.5 rounded-full group-has-[:checked]:translate-x-[1.625rem] bg-white shadow-[0_2px_0_rgb(29_17_71/0.18)] transition-transform duration-300 ease-out-back" />
                  </span>
                </label>
                )}
              </FormSection>

              <fieldset className="flex min-w-0 flex-col gap-3 border-t border-line pt-6">
                <legend className="float-left mb-1 w-full text-lg font-black leading-snug tracking-[-0.02em] text-ink">Variações</legend>
                <p className="-mt-1 text-sm font-semibold leading-snug text-ink-muted">
                  {produto
                    ? 'Opcionais, como tamanho ou cor: o cliente escolhe uma e o preço dela substitui o do produto.'
                    : servico
                      ? 'Opcionais, como pacotes: o cliente escolhe uma e o preço dela substitui o do serviço.'
                      : 'Com variações, o cliente escolhe uma e o preço dela substitui o do item.'}
                </p>
                {errors.variations ? (
                  <p role="alert" className="flex items-start gap-1.5 text-sm font-bold leading-5 text-danger">
                    <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
                    <span>{errors.variations}</span>
                  </p>
                ) : null}
                {/* A ordem da lista é a ordem na vitrine: a posição sai daqui ao salvar. */}
                <SortableList
                  entries={variations.map((row, index) => ({ id: row.key, label: row.name.trim() || `Variação ${index + 1}` }))}
                  onReorder={(orderedKeys) => {
                    setVariations((rows) => orderedKeys.map((key) => rows.find((row) => row.key === key)!))
                    markDirty()
                  }}
                >
                  {variations.map((row, index) => {
                    const n = index + 1
                    return (
                      // A entrada animada fica por dentro: a animação (transform) não pode brigar com o arrasto.
                      <SortableItem key={row.key} id={row.key} as="div">
                        <div className="flex animate-rise flex-col gap-3 rounded-control border-2 border-line bg-surface p-3 pl-1.5">
                          <div className="flex items-center gap-2">
                            <DragHandle label={`Reordenar variação ${n}`} className="-mr-1 h-11 w-8 rounded-control" />
                            <span
                              aria-hidden="true"
                              className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-go-strong bg-surface text-sm font-black text-go-strong numeric"
                            >
                              {n}
                            </span>
                            <Input
                              aria-label={`Nome da variação ${n}`}
                              placeholder={produto ? 'Nome (ex.: Tamanho M)' : 'Nome (ex.: Grande)'}
                              value={row.name}
                              maxLength={40}
                              onChange={(event) => updateVariation(row.key, { name: event.target.value })}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              aria-label={`Remover variação ${n}`}
                              title="Remover"
                              onClick={() => setVariations((rows) => rows.filter((r) => r.key !== row.key))}
                              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 aria-hidden="true" className="size-5" strokeWidth={2.5} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-1.5">
                            <MoneyInput
                              aria-label={`Preço da variação ${n}`}
                              placeholder="Preço"
                              value={row.price}
                              onChange={(event) => updateVariation(row.key, { price: event.target.value })}
                            />
                            <MoneyInput
                              aria-label={`Preço promocional da variação ${n}`}
                              placeholder="Promoção"
                              value={row.promoPrice}
                              onChange={(event) => updateVariation(row.key, { promoPrice: event.target.value })}
                            />
                          </div>
                          <label className="ml-1.5 flex w-fit cursor-pointer items-center gap-2.5 text-sm font-bold text-ink">
                            <input
                              type="checkbox"
                              aria-label={`Variação ${n} esgotada`}
                              checked={row.soldOut}
                              onChange={(event) => updateVariation(row.key, { soldOut: event.target.checked })}
                              className="size-5 cursor-pointer accent-danger"
                            />
                            Esgotada
                          </label>
                        </div>
                      </SortableItem>
                    )
                  })}
                </SortableList>
                <Button
                  variant="secondary"
                  disabled={variations.length >= 20}
                  className="self-start"
                  onClick={() =>
                    setVariations((rows) => [...rows, { key: newKey(), id: null, name: '', price: '', promoPrice: '', soldOut: false }])
                  }
                >
                  <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
                  Adicionar variação
                </Button>
              </fieldset>
            </div>

            {/* Passo 4: ajustes do WhatsApp (tudo opcional). */}
            <div hidden={step !== 3} className="flex flex-col gap-7">
              <details ref={advancedRef} className="group rounded-card border border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card p-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-lg font-black leading-snug tracking-[-0.02em] text-ink">Avançado</span>
                    <span className="text-sm font-semibold text-ink-muted">WhatsApp do item, texto do botão e mensagem.</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5 shrink-0 text-ink-muted transition-transform duration-200 ease-out-quint group-open:rotate-180"
                    strokeWidth={3}
                  />
                </summary>
                <div className="flex flex-col gap-5 border-t border-line p-5">
                  <Field label="WhatsApp do item" htmlFor="whatsappId" error={errors.whatsappId}>
                    <Select
                      id="whatsappId"
                      name="whatsappId"
                      defaultValue={values?.whatsappId ?? item?.whatsapp_id ?? ''}
                      invalid={!!errors.whatsappId}
                    >
                      <option value="">Usar o principal</option>
                      {props.contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Texto do botão" htmlFor="buttonText" error={errors.buttonText}>
                    <Input
                      id="buttonText"
                      name="buttonText"
                      maxLength={30}
                      placeholder={props.defaultButtonText}
                      defaultValue={values?.buttonText ?? item?.button_text ?? ''}
                      invalid={!!errors.buttonText}
                    />
                  </Field>
                  <Field
                    label="Mensagem personalizada"
                    htmlFor="customMessage"
                    error={errors.customMessage}
                    hint="Variáveis: {item}, {codigo}, {variacao}, {vitrine}, {pedido}"
                  >
                    <Textarea
                      id="customMessage"
                      name="customMessage"
                      rows={3}
                      maxLength={500}
                      defaultValue={values?.customMessage ?? item?.custom_message ?? ''}
                      invalid={!!errors.customMessage}
                    />
                  </Field>
                </div>
              </details>
            </div>
          </form>

          <FormMessage error={state.error} />
        </div>
      </div>

      {/* Rodapé fixo do popup: voltar, salvar (a qualquer momento) e continuar. */}
      <footer className="flex items-center gap-2 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:gap-3 sm:px-6 sm:pb-4 sm:pt-4">
        {step > 0 ? (
          <Button variant="ghost" aria-label="Voltar" onClick={() => goTo(step - 1)} className="max-sm:w-12 max-sm:px-0">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={3} />
            <span className="max-sm:hidden">Voltar</span>
          </Button>
        ) : null}
        <div className="ml-auto flex min-w-0 flex-1 justify-end gap-2 sm:flex-none sm:gap-3">
          {/* Chaves diferentes: sem elas o React reaproveita o mesmo <button> e o troca
              para submit durante o clique em Continuar, enviando o formulário antes da hora. */}
          <Button
            key="save"
            type="submit"
            form="item-form"
            variant={last ? 'primary' : 'secondary'}
            size="lg"
            disabled={pending}
            aria-busy={pending}
            className="min-w-0 flex-1 whitespace-nowrap px-3 sm:flex-none sm:px-6"
          >
            {pending ? <Spinner className="size-5" /> : <Check aria-hidden="true" className="size-5 shrink-0 max-sm:hidden" strokeWidth={3} />}
            Salvar item
          </Button>
          {last ? null : (
            <Button key="next" size="lg" onClick={() => goTo(step + 1)} className="min-w-0 flex-1 whitespace-nowrap px-3 sm:flex-none sm:min-w-44 sm:px-6">
              Continuar
              <ArrowRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={3} />
            </Button>
          )}
        </div>
      </footer>
      <UnsavedChangesGuard formId="item-form" />
    </>
  )
}

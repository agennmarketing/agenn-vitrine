'use client'

import { Check, ChevronDown, CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { VideoSlot } from '@/components/media/video-slot'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Select, Textarea } from '@/components/ui/input'
import { DragHandle, SortableItem, SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/submit-button'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { saveItemAction } from '@/features/items/actions'
import type { getItemForEdit } from '@/features/items/queries'
import { normalizeItemCode } from '@/lib/codes/item-code'
import { fetchAvailability } from '@/lib/forms/availability'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput } from '@/lib/money/money'

type ItemForEdit = Awaited<ReturnType<typeof getItemForEdit>>
type Slot = { id: string; url: string } | null
type VariationRow = { key: string; id: string | null; name: string; price: string; promoPrice: string; soldOut: boolean }

const ADVANCED_FIELDS = ['whatsappId', 'buttonText', 'customMessage']
const PRICE_TYPES = [
  ['fixed', 'Preço fixo'],
  ['from', 'A partir de'],
  ['on_request', 'Sob consulta'],
] as const

function newKey() {
  return Math.random().toString(36).slice(2)
}

// Seção do formulário: cartão com título forte e apoio curto.
function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-card border-2 border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-black leading-snug tracking-[-0.02em] text-ink">{title}</h3>
        {description ? <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{description}</p> : null}
      </div>
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

export function ItemForm(props: {
  vitrineId: string
  vitrineType: string
  defaultButtonText: string
  categories: { id: string; name: string }[]
  contacts: { id: string; label: string }[]
  nextCode: string
  videoLimits: { maxSeconds: number; maxUploadMb: number }
  addonGroups: { id: string; name: string }[]
  item?: ItemForEdit
}) {
  const { vitrineId, item } = props
  const [coverId, setCoverId] = useState<string>(item?.cover?.id ?? '')
  const [videoId, setVideoId] = useState<string>(item?.video?.id ?? '')
  const [galleryIds, setGalleryIds] = useState<(string | null)[]>([item?.gallery[0]?.id ?? null, item?.gallery[1]?.id ?? null])
  const [priceType, setPriceType] = useState<string>(item?.price_type ?? 'fixed')
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
  const [groupIds, setGroupIds] = useState<string[]>(item?.addonGroupIds ?? [])
  const [codeEdited, setCodeEdited] = useState(false)
  const [codeCheck, setCodeCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef<AbortController>(undefined)
  const advancedRef = useRef<HTMLDetailsElement>(null)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inFlight.current?.abort()
    },
    [],
  )

  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveItemAction(vitrineId, item?.id ?? null, prev, formData)
    if (result.fieldErrors && ADVANCED_FIELDS.some((field) => result.fieldErrors?.[field]) && advancedRef.current) {
      advancedRef.current.open = true
    }
    return result
  }, {})

  const errors = state.fieldErrors ?? {}
  const values = state.values

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

  const groupName = (id: string) => props.addonGroups.find((group) => group.id === id)?.name ?? 'Grupo'

  const showPrices = priceType !== 'on_request'
  const initialCode = item?.code ?? props.nextCode

  return (
    // Folga embaixo no celular para a barra fixa de salvar não cobrir o fim do formulário.
    <div className="flex max-w-2xl flex-col gap-5 pb-24 lg:pb-0">
      <FormSection title="Fotos e vídeo" description="A capa é a foto que aparece na vitrine. As outras duas são opcionais.">
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
        <div className="flex flex-col gap-2">
          <VideoSlot
            label="Vídeo"
            role="video"
            vitrineId={vitrineId}
            itemId={item?.id}
            initial={item?.video ?? null}
            limits={props.videoLimits}
            onChange={(media) => setVideoId(media?.id ?? '')}
          />
          <p className="text-sm font-semibold text-ink-muted">
            Até {props.videoLimits.maxSeconds} s, vertical (9:16) ou horizontal (16:9).
          </p>
        </div>
      </FormSection>

      <form id="item-form" action={formAction} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="coverMediaId" value={coverId} />
        <input type="hidden" name="galleryMediaIds" value={JSON.stringify(galleryIds.filter(Boolean))} />
        <input type="hidden" name="videoMediaId" value={videoId} />
        <input type="hidden" name="addonGroupIds" value={JSON.stringify(groupIds)} />
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

        <FormSection title="Informações">
          <Field label="Nome" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              maxLength={80}
              placeholder="Ex.: X-Bacon da casa"
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
              placeholder="O que vem, tamanho, sabor, detalhes que ajudam a escolher."
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
          {props.vitrineType === 'servicos' ? (
            <Field label="Duração (minutos)" htmlFor="durationMinutes" error={errors.durationMinutes}>
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
          ) : (
            <input type="hidden" name="durationMinutes" value="" />
          )}
          <Field label="Etiquetas" htmlFor="tags" error={errors.tags} hint="Até 5, separadas por vírgula.">
            <Input
              id="tags"
              name="tags"
              placeholder="Ex.: novo, vegano"
              defaultValue={values?.tags ?? (item?.tags ?? []).join(', ')}
              invalid={!!errors.tags}
            />
          </Field>
        </FormSection>

        <FormSection title="Preço e variações">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-[0.9375rem] font-extrabold leading-5 text-ink">Tipo de preço</legend>
            <div className="grid grid-cols-3 gap-2">
              {PRICE_TYPES.map(([value, label]) => (
                <label
                  key={value}
                  className="pressable relative flex h-12 cursor-pointer items-center justify-center rounded-control border-2 border-line-strong bg-surface px-2 text-center text-sm font-extrabold leading-tight text-ink [--lip:var(--color-line-strong)] hover:bg-canvas has-[:checked]:border-go has-[:checked]:bg-go-soft has-[:checked]:text-go-strong has-[:checked]:[--lip:var(--color-go)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong"
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

          <label className="group flex cursor-pointer items-center justify-between gap-4 rounded-control border-2 border-line p-4 has-[:checked]:border-danger/40 has-[:checked]:bg-danger-soft/50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong">
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

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-1 text-[0.9375rem] font-extrabold leading-5 text-ink">Variações</legend>
            <p className="-mt-1 text-sm font-semibold leading-snug text-ink-muted">
              Com variações, o cliente escolhe uma e o preço dela substitui o do item.
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
                    <div className="flex animate-rise flex-col gap-3 rounded-control border-2 border-line bg-canvas p-3 pl-1.5">
                      <div className="flex items-center gap-2">
                        <DragHandle label={`Reordenar variação ${n}`} className="-mr-1 h-11 w-8 rounded-control" />
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-deep text-sm font-black text-deep-ink numeric"
                        >
                          {n}
                        </span>
                        <Input
                          aria-label={`Nome da variação ${n}`}
                          placeholder="Nome (ex.: Grande)"
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
        </FormSection>

        <FormSection
          title="Complementos"
          description="Os grupos aparecem na ordem em que foram marcados. Com dois ou mais, arraste para mudar a ordem."
        >
          {props.addonGroups.length === 0 ? (
            <p className="rounded-control border-2 border-dashed border-line-strong px-4 py-4 text-sm font-semibold text-ink-muted">
              Nenhum grupo criado. Crie grupos na aba Complementos.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {props.addonGroups.map((group) => {
                const order = groupIds.indexOf(group.id)
                return (
                  <ChoiceCard
                    key={group.id}
                    type="checkbox"
                    aria-label={group.name}
                    title={group.name}
                    description={order >= 0 ? `${order + 1}º na ordem` : undefined}
                    checked={order >= 0}
                    onChange={(event) =>
                      setGroupIds((ids) => (event.target.checked ? [...ids, group.id] : ids.filter((id) => id !== group.id)))
                    }
                  />
                )
              })}
            </div>
          )}
          {groupIds.length >= 2 ? (
            <div className="flex flex-col gap-2">
              <p id="ordem-complementos" className="text-[0.9375rem] font-extrabold leading-5 text-ink">
                Ordem na vitrine
              </p>
              <SortableList
                entries={groupIds.map((id) => ({ id, label: groupName(id) }))}
                onReorder={(orderedIds) => {
                  setGroupIds(orderedIds)
                  markDirty()
                }}
              >
                <ol aria-labelledby="ordem-complementos" className="flex flex-col rounded-control border-2 border-line bg-surface">
                  {groupIds.map((id, index) => (
                    <SortableItem
                      key={id}
                      id={id}
                      className={`flex items-center gap-2 py-1 pl-1 pr-3 ${index > 0 ? 'border-t-2 border-line' : ''}`}
                    >
                      {/* Rótulo sem o nome do grupo: o nome já rotula a caixa de marcar lá em cima. */}
                      <DragHandle label={`Reordenar ${index + 1}º grupo`} className="h-11 w-9 rounded-control" />
                      <span
                        aria-hidden="true"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-deep text-xs font-black text-deep-ink numeric"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 truncate font-extrabold text-ink">{groupName(id)}</span>
                    </SortableItem>
                  ))}
                </ol>
              </SortableList>
            </div>
          ) : null}
        </FormSection>

        <details ref={advancedRef} className="group rounded-card border-2 border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card p-5 sm:px-6 [&::-webkit-details-marker]:hidden">
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
          <div className="flex flex-col gap-5 border-t-2 border-line p-5 sm:px-6">
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

        <FormMessage error={state.error} />

        {/* No celular a barra de salvar fica fixa acima da navegação inferior; no computador, no fim do formulário. */}
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t-2 border-line bg-surface px-4 py-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full lg:w-auto lg:min-w-52">
            {pending ? <Spinner className="size-5" /> : <Check aria-hidden="true" className="size-5" strokeWidth={3} />}
            Salvar item
          </Button>
        </div>
      </form>
      <UnsavedChangesGuard formId="item-form" />
    </div>
  )
}

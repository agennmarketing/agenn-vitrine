'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { checkItemCodeAction, saveItemAction } from '@/features/items/actions'
import type { getItemForEdit } from '@/features/items/queries'
import { normalizeItemCode } from '@/lib/codes/item-code'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput } from '@/lib/money/money'

type ItemForEdit = Awaited<ReturnType<typeof getItemForEdit>>
type Slot = { id: string; url: string } | null
type VariationRow = { key: string; id: string | null; name: string; price: string; promoPrice: string; soldOut: boolean }

const ADVANCED_FIELDS = ['whatsappId', 'buttonText', 'customMessage']
const textareaClass = 'w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-base'
const selectClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

function newKey() {
  return Math.random().toString(36).slice(2)
}

export function ItemForm(props: {
  vitrineId: string
  vitrineType: string
  defaultButtonText: string
  categories: { id: string; name: string }[]
  contacts: { id: string; label: string }[]
  nextCode: string
  item?: ItemForEdit
}) {
  const { vitrineId, item } = props
  const [coverId, setCoverId] = useState<string>(item?.cover?.id ?? '')
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
  const [codeEdited, setCodeEdited] = useState(false)
  const [codeCheck, setCodeCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const advancedRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])

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
    const value = normalizeItemCode(raw)
    if (!value || value === item?.code) return
    timer.current = setTimeout(async () => setCodeCheck(await checkItemCodeAction(value, item?.id ?? null)), 400)
  }

  function updateVariation(key: string, patch: Partial<VariationRow>) {
    setVariations((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const showPrices = priceType !== 'on_request'
  const initialCode = item?.code ?? props.nextCode

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-medium">Imagens</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <ImageSlot
              label="Capa"
              role="cover"
              vitrineId={vitrineId}
              itemId={item?.id}
              initial={item?.cover ?? null}
              onChange={(media) => setCoverId(media?.id ?? '')}
            />
            {errors.coverMediaId ? (
              <p role="alert" className="text-sm text-danger">
                {errors.coverMediaId}
              </p>
            ) : null}
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
      </Card>

      <Card className="p-5">
        <form id="item-form" action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="coverMediaId" value={coverId} />
          <input type="hidden" name="galleryMediaIds" value={JSON.stringify(galleryIds.filter(Boolean))} />
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

          <Field label="Nome" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" maxLength={80} defaultValue={values?.name ?? item?.name ?? ''} invalid={!!errors.name} />
          </Field>
          <Field label="Descrição" htmlFor="description" error={errors.description}>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={1000}
              defaultValue={values?.description ?? item?.description ?? ''}
              className={textareaClass}
            />
          </Field>
          <Field label="Categoria" htmlFor="categoryId" error={errors.categoryId}>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={values?.categoryId ?? item?.category_id ?? props.categories[0]?.id ?? ''}
              className={selectClass}
            >
              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Código" htmlFor="code" error={errors.code}>
            <Input
              id="code"
              name="code"
              maxLength={6}
              autoCapitalize="characters"
              defaultValue={values?.code ?? initialCode}
              invalid={!!errors.code}
              onChange={(event) => onCodeChange(event.target.value)}
            />
          </Field>
          {codeCheck ? (
            <p className={`text-sm ${codeCheck.ok ? 'text-brand' : 'text-danger'}`} aria-live="polite">
              {codeCheck.message}
            </p>
          ) : null}

          <Field label="Tipo de preço" htmlFor="priceType" error={errors.priceType}>
            <select
              id="priceType"
              name="priceType"
              value={priceType}
              onChange={(event) => setPriceType(event.target.value)}
              className={selectClass}
            >
              <option value="fixed">Preço fixo</option>
              <option value="from">A partir de</option>
              <option value="on_request">Sob consulta</option>
            </select>
          </Field>
          <div hidden={!showPrices} className="grid gap-4 sm:grid-cols-2">
            <Field label="Preço" htmlFor="price" error={errors.price}>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                placeholder="49,90"
                defaultValue={values?.price ?? centsToInput(item?.price_cents ?? null)}
                invalid={!!errors.price}
              />
            </Field>
            <Field label="Preço promocional" htmlFor="promoPrice" error={errors.promoPrice}>
              <Input
                id="promoPrice"
                name="promoPrice"
                inputMode="decimal"
                defaultValue={values?.promoPrice ?? centsToInput(item?.promo_price_cents ?? null)}
                invalid={!!errors.promoPrice}
              />
            </Field>
          </div>

          {props.vitrineType === 'servicos' ? (
            <Field label="Duração (minutos)" htmlFor="durationMinutes" error={errors.durationMinutes}>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                inputMode="numeric"
                defaultValue={values?.durationMinutes ?? (item?.duration_minutes ? String(item.duration_minutes) : '')}
                invalid={!!errors.durationMinutes}
              />
            </Field>
          ) : (
            <input type="hidden" name="durationMinutes" value="" />
          )}

          <Field label="Etiquetas" htmlFor="tags" error={errors.tags} hint="Até 5, separadas por vírgula.">
            <Input id="tags" name="tags" defaultValue={values?.tags ?? (item?.tags ?? []).join(', ')} invalid={!!errors.tags} />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="soldOut" defaultChecked={values ? values.soldOut === 'on' : item?.sold_out} />
            Esgotado
          </label>

          <fieldset className="flex flex-col gap-3">
            <legend className="font-medium">Variações</legend>
            <p className="text-sm text-ink-muted">Com variações, o cliente escolhe uma e o preço dela substitui o do item.</p>
            {errors.variations ? (
              <p role="alert" className="text-sm text-danger">
                {errors.variations}
              </p>
            ) : null}
            {variations.map((row, index) => {
              const n = index + 1
              return (
                <div key={row.key} className="grid gap-2 rounded-control border border-line p-3 sm:grid-cols-4">
                  <Input
                    aria-label={`Nome da variação ${n}`}
                    placeholder="Nome"
                    value={row.name}
                    maxLength={40}
                    onChange={(event) => updateVariation(row.key, { name: event.target.value })}
                  />
                  <Input
                    aria-label={`Preço da variação ${n}`}
                    placeholder="Preço"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateVariation(row.key, { price: event.target.value })}
                  />
                  <Input
                    aria-label={`Preço promocional da variação ${n}`}
                    placeholder="Promoção"
                    inputMode="decimal"
                    value={row.promoPrice}
                    onChange={(event) => updateVariation(row.key, { promoPrice: event.target.value })}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Variação ${n} esgotada`}
                        checked={row.soldOut}
                        onChange={(event) => updateVariation(row.key, { soldOut: event.target.checked })}
                      />
                      Esgotada
                    </label>
                    <Button
                      variant="ghost"
                      aria-label={`Remover variação ${n}`}
                      onClick={() => setVariations((rows) => rows.filter((r) => r.key !== row.key))}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )
            })}
            <Button
              variant="secondary"
              disabled={variations.length >= 20}
              className="self-start"
              onClick={() =>
                setVariations((rows) => [...rows, { key: newKey(), id: null, name: '', price: '', promoPrice: '', soldOut: false }])
              }
            >
              Adicionar variação
            </Button>
          </fieldset>

          <details ref={advancedRef} className="rounded-control border border-line p-3">
            <summary className="cursor-pointer font-medium">Avançado</summary>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="WhatsApp do item" htmlFor="whatsappId" error={errors.whatsappId}>
                <select
                  id="whatsappId"
                  name="whatsappId"
                  defaultValue={values?.whatsappId ?? item?.whatsapp_id ?? ''}
                  className={selectClass}
                >
                  <option value="">Usar o principal</option>
                  {props.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.label}
                    </option>
                  ))}
                </select>
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
                <textarea
                  id="customMessage"
                  name="customMessage"
                  rows={3}
                  maxLength={500}
                  defaultValue={values?.customMessage ?? item?.custom_message ?? ''}
                  className={textareaClass}
                />
              </Field>
            </div>
          </details>

          <FormMessage error={state.error} />
          <Button type="submit" disabled={pending} className="self-start">
            Salvar item
          </Button>
        </form>
        <UnsavedChangesGuard formId="item-form" />
      </Card>
    </div>
  )
}

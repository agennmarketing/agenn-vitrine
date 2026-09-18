'use client'

import { Bike, CircleAlert, Pencil, ShoppingBag, Store, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { addonMessageLines } from '@/lib/addons/addons'
import { removeLine, setLineQty, type CartLine } from '@/lib/cart/cart'
import {
  CASH_OPTION,
  EMPTY_CHECKOUT_INPUT,
  todayInSaoPaulo,
  validateCheckout,
  type CheckoutInput,
} from '@/lib/cart/checkout'
import { cartSummary, lineUnitCents, reconcileCart } from '@/lib/cart/reconcile'
import { formatBRL } from '@/lib/money/money'
import { formatOrderTotal, lineTotalCents } from '@/lib/pricing/price'
import { buildCartWhatsAppUrl } from './send-cart'
import { brandButtonClass, CloseButton, fieldClass, OptionMark, optionCardClass, optionInputClass, SheetHandle, StepButton, WhatsAppIcon } from './vitrine-ui'

function CheckoutField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[0.9375rem] font-bold">
        {label}
      </label>
      {children}
      {error}
    </div>
  )
}

export default function CartSheet({
  vitrine,
  lines,
  setLines,
  items,
  onEdit,
  onClose,
}: {
  vitrine: PublicVitrine
  lines: CartLine[]
  setLines: (lines: CartLine[]) => void
  items: ReadonlyMap<string, PublicItem>
  onEdit: (line: CartLine) => void
  onClose: () => void
}) {
  // Spec 7.4: ao abrir, confere com os dados atuais.
  const [removedNames] = useState(() => reconcileCart(lines, items).removedNames)
  const [input, setInput] = useState<CheckoutInput>(EMPTY_CHECKOUT_INPUT)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutInput, string>>>({})
  const [sending, setSending] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const fieldId = (field: keyof CheckoutInput) => `${id}-${field}`

  useEffect(() => {
    const reconciled = reconcileCart(lines, items)
    if (reconciled.removedNames.length > 0) setLines(reconciled.lines)
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const summary = cartSummary(lines, items)
  const settings = vitrine.checkout
  const set = (field: keyof CheckoutInput) => (value: string) => setInput((current) => ({ ...current, [field]: value }))
  const errorText = (field: keyof CheckoutInput) =>
    errors[field] ? (
      <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-danger">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
        {errors[field]}
      </p>
    ) : null
  const invalid = (field: keyof CheckoutInput) => (errors[field] ? true : undefined)

  async function onSubmit() {
    const result = validateCheckout(settings, input, todayInSaoPaulo())
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSending(true)
    const url = await buildCartWhatsAppUrl(vitrine, lines, items, result.value)
    if (!url) {
      setSending(false)
      return
    }
    setLines([])
    window.location.assign(url)
  }

  const hasCheckout =
    settings.nameMode !== 'off' ||
    settings.fulfillmentMode !== 'off' ||
    settings.paymentMode !== 'off' ||
    settings.scheduleMode !== 'off' ||
    settings.notesMode !== 'off'

  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-black/55 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sacola"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.75rem] bg-surface text-ink shadow-float md:max-h-[min(88dvh,820px)] md:max-w-[600px] md:rounded-[1.75rem]"
      >
        <div className="shrink-0 pt-2 md:pt-0">
          <SheetHandle />
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 md:px-7 md:pt-6">
            <h2 className="flex items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em]">
              Sacola
              {summary.count > 0 ? (
                <span className="numeric text-base font-semibold text-ink-muted">
                  {summary.count === 1 ? '1 item' : `${summary.count} itens`}
                </span>
              ) : null}
            </h2>
            <CloseButton buttonRef={closeRef} onClick={onClose} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 md:px-7">
          {removedNames.length > 0 ? (
            <p role="status" className="mb-4 flex gap-2 rounded-2xl bg-subtle p-4 text-sm leading-snug">
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-ink-muted" strokeWidth={2.5} />
              <span>Alguns itens saíram da sacola porque não estão mais disponíveis: {removedNames.join(', ')}.</span>
            </p>
          ) : null}

          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-subtle text-ink-muted">
                <ShoppingBag aria-hidden="true" className="size-7" strokeWidth={2.25} />
              </span>
              <p className="text-ink-muted">Sua sacola está vazia.</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 font-semibold underline decoration-2 underline-offset-4"
              >
                Continuar escolhendo
              </button>
            </div>
          ) : null}

          <ul className="flex flex-col divide-y divide-line">
            {lines.map((line) => {
              const item = items.get(line.itemId)
              if (!item) return null
              const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
              const label = variation ? `${item.name} – ${variation.name}` : item.name
              const subtotal = lineTotalCents(lineUnitCents(line, item), line.qty)
              return (
                <li key={line.key} className="flex gap-3 py-4">
                  {vitrine.showMedia && item.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover.small}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="size-16 shrink-0 rounded-xl bg-subtle object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-bold leading-snug">{label}</span>
                      {vitrine.showPrices ? (
                        <span className="numeric shrink-0 font-bold">{subtotal === null ? 'Sob consulta' : formatBRL(subtotal)}</span>
                      ) : null}
                    </div>
                    {addonMessageLines(item.addonGroups, line.addons).map((text) => (
                      <span key={text} className="text-sm leading-snug text-ink-muted">
                        {text.trim().replace(/^• /, '')}
                      </span>
                    ))}
                    {line.note ? <span className="text-sm leading-snug text-ink-muted">Obs: {line.note}</span> : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1 rounded-full bg-subtle p-1">
                        <StepButton
                          kind="minus"
                          aria-label={`Diminuir ${item.name}`}
                          onClick={() => setLines(setLineQty(lines, line.key, line.qty - 1))}
                        />
                        <span aria-live="polite" className="numeric w-7 text-center font-bold">
                          {line.qty}
                        </span>
                        <StepButton
                          kind="plus"
                          tone="neutral"
                          aria-label={`Aumentar ${item.name}`}
                          disabled={line.qty >= 99}
                          onClick={() => setLines(setLineQty(lines, line.key, line.qty + 1))}
                        />
                      </div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => onEdit(line)}
                          className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-subtle"
                        >
                          <Pencil aria-hidden="true" className="size-4" strokeWidth={2.5} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setLines(removeLine(lines, line.key))}
                          className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-subtle hover:text-danger"
                        >
                          <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {lines.length > 0 && hasCheckout ? (
            <div className="mt-4 flex flex-col gap-5 border-t border-line pt-6">
              <h3 className="text-lg font-extrabold tracking-[-0.01em]">Seus dados</h3>

              {settings.nameMode !== 'off' ? (
                <CheckoutField label="Nome" htmlFor={fieldId('name')} error={errorText('name')}>
                  <input
                    id={fieldId('name')}
                    className={fieldClass}
                    value={input.name}
                    maxLength={60}
                    autoComplete="name"
                    aria-invalid={invalid('name')}
                    onChange={(e) => set('name')(e.target.value)}
                  />
                </CheckoutField>
              ) : null}

              {settings.fulfillmentMode !== 'off' ? (
                <fieldset className="flex min-w-0 flex-col gap-2">
                  <legend className="mb-2 text-[0.9375rem] font-bold">Como você quer receber?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['retirada', 'Retirada', Store],
                        ['entrega', 'Entrega', Bike],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <label key={value} className={optionCardClass}>
                        <input
                          type="radio"
                          name="fulfillment"
                          checked={input.fulfillment === value}
                          onChange={() => set('fulfillment')(value)}
                          className={optionInputClass}
                        />
                        <OptionMark type="radio" />
                        <span className="flex min-w-0 items-center gap-2 font-semibold">
                          <Icon aria-hidden="true" className="size-5 shrink-0 text-ink-muted" strokeWidth={2.25} />
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errorText('fulfillment')}
                  {input.fulfillment === 'entrega' ? (
                    <div className="mt-2">
                      <CheckoutField label="Endereço de entrega" htmlFor={fieldId('address')} error={errorText('address')}>
                        <input
                          id={fieldId('address')}
                          className={fieldClass}
                          value={input.address}
                          maxLength={200}
                          autoComplete="street-address"
                          aria-invalid={invalid('address')}
                          onChange={(e) => set('address')(e.target.value)}
                        />
                      </CheckoutField>
                    </div>
                  ) : null}
                </fieldset>
              ) : null}

              {settings.paymentMode !== 'off' ? (
                <CheckoutField label="Forma de pagamento" htmlFor={fieldId('payment')} error={errorText('payment')}>
                  <select
                    id={fieldId('payment')}
                    className={`${fieldClass} select-chevron appearance-none pr-11`}
                    value={input.payment}
                    aria-invalid={invalid('payment')}
                    onChange={(e) => set('payment')(e.target.value)}
                  >
                    <option value="">Escolha</option>
                    {settings.paymentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </CheckoutField>
              ) : null}
              {input.payment === CASH_OPTION ? (
                <CheckoutField label="Troco para quanto?" htmlFor={fieldId('changeFor')} error={errorText('changeFor')}>
                  <input
                    id={fieldId('changeFor')}
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder="50,00"
                    value={input.changeFor}
                    aria-invalid={invalid('changeFor')}
                    onChange={(e) => set('changeFor')(e.target.value)}
                  />
                </CheckoutField>
              ) : null}

              {settings.scheduleMode !== 'off' ? (
                <div className="grid grid-cols-2 gap-3">
                  <CheckoutField label="Data" htmlFor={fieldId('date')} error={errorText('date')}>
                    <input
                      id={fieldId('date')}
                      type="date"
                      className={fieldClass}
                      value={input.date}
                      min={todayInSaoPaulo()}
                      aria-invalid={invalid('date')}
                      onChange={(e) => set('date')(e.target.value)}
                    />
                  </CheckoutField>
                  <CheckoutField label="Horário" htmlFor={fieldId('time')} error={errorText('time')}>
                    <input
                      id={fieldId('time')}
                      type="time"
                      className={fieldClass}
                      value={input.time}
                      aria-invalid={invalid('time')}
                      onChange={(e) => set('time')(e.target.value)}
                    />
                  </CheckoutField>
                </div>
              ) : null}

              {settings.notesMode !== 'off' ? (
                <CheckoutField label="Observações" htmlFor={fieldId('notes')} error={errorText('notes')}>
                  <textarea
                    id={fieldId('notes')}
                    rows={3}
                    maxLength={300}
                    value={input.notes}
                    aria-invalid={invalid('notes')}
                    onChange={(e) => set('notes')(e.target.value)}
                    className={`${fieldClass} h-auto resize-none py-3 leading-snug`}
                  />
                </CheckoutField>
              ) : null}
            </div>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 md:px-7 md:pb-6 md:pt-4">
            {vitrine.showPrices ? (
              <p className="numeric mb-3 flex items-baseline justify-between text-lg font-extrabold">Total: {formatOrderTotal(summary.total)}</p>
            ) : null}
            <button
              type="button"
              disabled={sending || !vitrine.primaryPhone}
              onClick={onSubmit}
              className={`${brandButtonClass} w-full`}
            >
              {vitrine.primaryPhone ? <WhatsAppIcon className="size-5 shrink-0" /> : null}
              {!vitrine.primaryPhone ? 'WhatsApp não configurado' : sending ? 'Abrindo o WhatsApp…' : vitrine.cartButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

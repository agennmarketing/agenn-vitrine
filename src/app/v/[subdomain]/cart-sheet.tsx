'use client'

import { useEffect, useRef, useState } from 'react'
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

const inputClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

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
      <p role="alert" className="text-sm text-danger">
        {errors[field]}
      </p>
    ) : null

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sacola"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface text-ink md:max-w-[640px] md:rounded-card"
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-semibold">Sacola</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-control px-3 py-2 text-sm">
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {removedNames.length > 0 ? (
            <p role="status" className="mb-3 rounded-control bg-subtle p-3 text-sm">
              Alguns itens saíram da sacola porque não estão mais disponíveis: {removedNames.join(', ')}.
            </p>
          ) : null}

          {lines.length === 0 ? <p className="text-ink-muted">Sua sacola está vazia.</p> : null}

          <ul className="flex flex-col divide-y divide-line">
            {lines.map((line) => {
              const item = items.get(line.itemId)
              if (!item) return null
              const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
              const label = variation ? `${item.name} – ${variation.name}` : item.name
              const subtotal = lineTotalCents(lineUnitCents(line, item), line.qty)
              return (
                <li key={line.key} className="flex flex-col gap-1 py-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    {vitrine.showPrices ? <span>{subtotal === null ? 'Sob consulta' : formatBRL(subtotal)}</span> : null}
                  </div>
                  {addonMessageLines(item.addonGroups, line.addons).map((text) => (
                    <span key={text} className="text-sm text-ink-muted">
                      {text.trim().replace(/^• /, '')}
                    </span>
                  ))}
                  {line.note ? <span className="text-sm text-ink-muted">Obs: {line.note}</span> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Diminuir ${item.name}`}
                      onClick={() => setLines(setLineQty(lines, line.key, line.qty - 1))}
                      className="size-9 rounded-full border border-line-strong"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="w-6 text-center">{line.qty}</span>
                    <button
                      type="button"
                      aria-label={`Aumentar ${item.name}`}
                      disabled={line.qty >= 99}
                      onClick={() => setLines(setLineQty(lines, line.key, line.qty + 1))}
                      className="size-9 rounded-full border border-line-strong disabled:opacity-40"
                    >
                      +
                    </button>
                    <button type="button" onClick={() => onEdit(line)} className="rounded-control px-3 py-2 text-sm underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setLines(removeLine(lines, line.key))}
                      className="rounded-control px-3 py-2 text-sm underline"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {vitrine.showPrices && lines.length > 0 ? (
            <p className="mt-3 font-semibold">Total: {formatOrderTotal(summary.total)}</p>
          ) : null}

          {lines.length > 0 ? (
            <div className="mt-5 flex flex-col gap-4">
              {settings.nameMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Nome
                  <input className={inputClass} value={input.name} maxLength={60} autoComplete="name" onChange={(e) => set('name')(e.target.value)} />
                  {errorText('name')}
                </label>
              ) : null}

              {settings.fulfillmentMode !== 'off' ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm">Como você quer receber?</legend>
                  {(
                    [
                      ['retirada', 'Retirada'],
                      ['entrega', 'Entrega'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input type="radio" name="fulfillment" checked={input.fulfillment === value} onChange={() => set('fulfillment')(value)} />
                      {label}
                    </label>
                  ))}
                  {errorText('fulfillment')}
                  {input.fulfillment === 'entrega' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      Endereço de entrega
                      <input className={inputClass} value={input.address} maxLength={200} autoComplete="street-address" onChange={(e) => set('address')(e.target.value)} />
                      {errorText('address')}
                    </label>
                  ) : null}
                </fieldset>
              ) : null}

              {settings.paymentMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Forma de pagamento
                  <select className={inputClass} value={input.payment} onChange={(e) => set('payment')(e.target.value)}>
                    <option value="">Escolha</option>
                    {settings.paymentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errorText('payment')}
                </label>
              ) : null}
              {input.payment === CASH_OPTION ? (
                <label className="flex flex-col gap-1 text-sm">
                  Troco para quanto?
                  <input className={inputClass} inputMode="decimal" placeholder="50,00" value={input.changeFor} onChange={(e) => set('changeFor')(e.target.value)} />
                  {errorText('changeFor')}
                </label>
              ) : null}

              {settings.scheduleMode !== 'off' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Data
                    <input type="date" className={inputClass} value={input.date} min={todayInSaoPaulo()} onChange={(e) => set('date')(e.target.value)} />
                    {errorText('date')}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Horário
                    <input type="time" className={inputClass} value={input.time} onChange={(e) => set('time')(e.target.value)} />
                    {errorText('time')}
                  </label>
                </div>
              ) : null}

              {settings.notesMode !== 'off' ? (
                <label className="flex flex-col gap-1 text-sm">
                  Observações
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={input.notes}
                    onChange={(e) => set('notes')(e.target.value)}
                    className="rounded-control border border-line-strong bg-surface px-3 py-2 text-base"
                  />
                  {errorText('notes')}
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-line p-4">
            <button
              type="button"
              disabled={sending || !vitrine.primaryPhone}
              onClick={onSubmit}
              className="h-12 w-full rounded-control bg-brand font-semibold text-brand-ink disabled:opacity-60"
            >
              {!vitrine.primaryPhone ? 'WhatsApp não configurado' : sending ? 'Abrindo o WhatsApp…' : vitrine.cartButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { validateAddonSelections, type AddonSelection } from '@/lib/addons/addons'
import type { CartLine, NewCartLine } from '@/lib/cart/cart'
import { lineUnitCents } from '@/lib/cart/reconcile'
import { formatBRL } from '@/lib/money/money'
import { formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { AddonPicker } from './addon-picker'
import { sendDirect } from './send-direct'
import { VideoPlayer } from './video-player'

export type ItemSheetProps = {
  vitrine: PublicVitrine
  item: PublicItem
  onClose: () => void
  cart?: { initial?: CartLine; onSubmit: (line: NewCartLine) => void }
}

export default function ItemSheet({ vitrine, item, onClose, cart }: ItemSheetProps) {
  const [variationId, setVariationId] = useState<string | null>(cart?.initial?.variationId ?? null)
  const [addons, setAddons] = useState<AddonSelection[]>(cart?.initial?.addons ?? [])
  const [qty, setQty] = useState(cart?.initial?.qty ?? 1)
  const [note, setNote] = useState(cart?.initial?.note ?? '')
  const [missingVariation, setMissingVariation] = useState(false)
  const [addonError, setAddonError] = useState<{ groupId: string | null; message: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const choicesRef = useRef<HTMLFieldSetElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const variation = item.variations.find((v) => v.id === variationId) ?? null
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  const images = [item.cover, ...item.gallery].filter((image) => image !== null)
  const line: NewCartLine = { itemId: item.id, variationId, qty, note, addons }
  const unitCents = lineUnitCents(line, item)
  const hasChoice = variation !== null || addons.length > 0
  const showPrice = vitrine.showPrices && !(variation && item.priceType === 'on_request')
  const headerPrice = hasChoice && unitCents !== null ? formatBRL(unitCents) : formatPriceLabel(priceLabel(item, item.variations))

  function validate(): boolean {
    if (item.variations.length > 0 && !variation) {
      setMissingVariation(true)
      choicesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return false
    }
    const check = validateAddonSelections(item.addonGroups, addons)
    if (!check.ok) {
      setAddonError({ groupId: check.groupId, message: check.message })
      if (check.groupId) {
        document.getElementById(`addon-group-${check.groupId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      return false
    }
    setAddonError(null)
    return true
  }

  async function onPrimary() {
    if (!validate()) return
    const normalized = validateAddonSelections(item.addonGroups, addons)
    const chosen = normalized.ok ? normalized.selections : addons
    if (cart) {
      cart.onSubmit({ itemId: item.id, variationId, qty, note: note.trim(), addons: chosen })
      return
    }
    setSending(true)
    await sendDirect(vitrine, item, {
      variation: variation ? { id: variation.id, name: variation.name } : null,
      addons: chosen,
      note,
    })
    // Se o navegador bloquear a abertura do WhatsApp, o botão volta a funcionar.
    setTimeout(() => setSending(false), 3000)
  }

  let buttonLabel: string
  if (cart) {
    const verb = cart.initial ? 'Salvar alterações' : 'Adicionar'
    buttonLabel = vitrine.showPrices && unitCents !== null ? `${verb} · ${formatBRL(unitCents * qty)}` : verb
  } else {
    buttonLabel = item.buttonText ?? vitrine.defaultButtonText
  }
  let disabled = sending
  if (item.soldOut) {
    buttonLabel = 'Esgotado'
    disabled = true
  } else if (!cart && !phone) {
    buttonLabel = 'WhatsApp não configurado'
    disabled = true
  } else if (sending) {
    buttonLabel = 'Abrindo o WhatsApp…'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface text-ink md:max-w-[640px] md:rounded-card"
      >
        <div className="flex justify-end p-2">
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-control px-3 py-2 text-sm">
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {vitrine.showMedia && (item.video || images.length > 0) ? (
            <div
              className="-mx-4 mb-4 flex snap-x snap-mandatory overflow-x-auto"
              onScroll={(event) => {
                const el = event.currentTarget
                setActiveIndex(el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0)
              }}
            >
              {/* Spec 6.3: vídeo primeiro. Fora da vista, o player desmonta (pausa e destrói). */}
              {item.video ? (
                <div className="w-full shrink-0 snap-center md:w-1/2">
                  {activeIndex === 0 ? (
                    <VideoPlayer video={item.video} className="aspect-[4/5] w-full bg-black object-cover" />
                  ) : item.video.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.video.posterUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-black" />
                  )}
                </div>
              ) : null}
              {images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.large}
                  src={image.large}
                  srcSet={`${image.small} ${image.smallWidth}w, ${image.large} ${image.largeWidth}w`}
                  sizes="(min-width: 768px) 640px, 100vw"
                  alt=""
                  className="aspect-[4/5] w-full shrink-0 snap-center object-cover md:w-1/2"
                />
              ))}
            </div>
          ) : null}

          <h2 className="text-xl font-semibold">{item.name}</h2>
          {showPrice ? <p className="mt-1 text-lg">{headerPrice}</p> : null}
          {item.durationMinutes ? <p className="text-sm text-ink-muted">{item.durationMinutes} min</p> : null}
          {item.description ? <p className="mt-3 whitespace-pre-line text-ink-muted">{item.description}</p> : null}
          {item.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-subtle px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {item.variations.length > 0 ? (
            <fieldset
              ref={choicesRef}
              className={`mt-5 flex flex-col gap-2 rounded-control border p-3 ${missingVariation ? 'border-danger' : 'border-line'}`}
            >
              <legend className="px-1 font-medium">Escolha uma opção</legend>
              <p className="text-xs text-ink-muted">Obrigatório · escolha 1</p>
              {item.variations.map((option) => (
                <label key={option.id} className={`flex items-center gap-2 ${option.soldOut ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="variation"
                    value={option.id}
                    disabled={option.soldOut}
                    checked={variationId === option.id}
                    onChange={() => {
                      setVariationId(option.id)
                      setMissingVariation(false)
                    }}
                  />
                  <span>
                    {option.name}
                    {vitrine.showPrices && item.priceType !== 'on_request'
                      ? ` · ${formatBRL(option.promoPriceCents ?? option.priceCents)}`
                      : ''}
                    {option.soldOut ? ' · Esgotado' : ''}
                  </span>
                </label>
              ))}
              {missingVariation ? (
                <p role="alert" className="text-sm text-danger">
                  Escolha uma opção.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {item.addonGroups.length > 0 ? (
            <AddonPicker
              groups={item.addonGroups}
              showPrices={vitrine.showPrices}
              selections={addons}
              onChange={(next) => {
                setAddons(next)
                setAddonError(null)
              }}
              errorGroupId={addonError?.groupId ?? null}
              errorMessage={addonError?.message ?? null}
            />
          ) : null}
          {addonError && !addonError.groupId ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {addonError.message}
            </p>
          ) : null}

          <label className="mt-5 flex flex-col gap-1 text-sm">
            Observação
            <textarea
              value={note}
              maxLength={140}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-2 text-base"
            />
            <span className="self-end text-xs text-ink-muted">{note.length}/140</span>
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-line p-4">
          {cart ? (
            <div className="flex items-center gap-2" aria-label="Quantidade" role="group">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                disabled={qty <= 1}
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="size-10 rounded-full border border-line-strong disabled:opacity-40"
              >
                −
              </button>
              <span aria-live="polite" className="w-6 text-center">{qty}</span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                disabled={qty >= 99}
                onClick={() => setQty((value) => Math.min(99, value + 1))}
                className="size-10 rounded-full border border-line-strong disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={onPrimary}
            className="h-12 flex-1 rounded-control bg-brand font-semibold text-brand-ink disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

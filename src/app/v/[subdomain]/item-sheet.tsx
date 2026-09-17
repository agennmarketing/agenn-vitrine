'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { formatBRL } from '@/lib/money/money'
import { formatPriceLabel, priceLabel, unitPriceCents } from '@/lib/pricing/price'
import { sendDirect } from './send-direct'

export type ItemSheetProps = { vitrine: PublicVitrine; item: PublicItem; onClose: () => void }

export default function ItemSheet({ vitrine, item, onClose }: ItemSheetProps) {
  const [variationId, setVariationId] = useState<string | null>(null)
  const [missingChoice, setMissingChoice] = useState(false)
  const [sending, setSending] = useState(false)
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
  const price = variation
    ? formatBRL(unitPriceCents(item, variation) ?? 0)
    : formatPriceLabel(priceLabel(item, item.variations))
  const showPrice = vitrine.showPrices && !(variation && item.priceType === 'on_request')

  async function onSend() {
    if (item.variations.length > 0 && !variation) {
      setMissingChoice(true)
      choicesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSending(true)
    await sendDirect(vitrine, item, variation ? { id: variation.id, name: variation.name } : null)
    // Se o navegador bloquear a abertura do WhatsApp, o botão volta a funcionar.
    setTimeout(() => setSending(false), 3000)
  }

  let buttonLabel = item.buttonText ?? vitrine.defaultButtonText
  let disabled = sending
  if (item.soldOut) {
    buttonLabel = 'Esgotado'
    disabled = true
  } else if (!phone) {
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
          {vitrine.showMedia && images.length > 0 ? (
            <div className="-mx-4 mb-4 flex snap-x snap-mandatory overflow-x-auto">
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
          {showPrice ? <p className="mt-1 text-lg">{price}</p> : null}
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
              className={`mt-5 flex flex-col gap-2 rounded-control border p-3 ${missingChoice ? 'border-danger' : 'border-line'}`}
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
                      setMissingChoice(false)
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
              {missingChoice ? (
                <p role="alert" className="text-sm text-danger">
                  Escolha uma opção.
                </p>
              ) : null}
            </fieldset>
          ) : null}
        </div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            disabled={disabled}
            onClick={onSend}
            className="h-12 w-full rounded-control bg-brand font-semibold text-brand-ink disabled:opacity-60"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock, ExternalLink, Info } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import type { CartLine, NewCartLine } from '@/lib/cart/cart'
import { lineUnitCents } from '@/lib/cart/reconcile'
import { formatBRL } from '@/lib/money/money'
import { formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { BookingFlow } from './booking-flow'
import { sendDirect } from './send-direct'
import { ItemVideo } from './item-video'
import {
  brandButtonClass,
  CloseButton,
  fieldClass,
  GroupBadge,
  OptionMark,
  optionCardClass,
  optionInputClass,
  StepButton,
  TagList,
  WhatsAppIcon,
} from './vitrine-ui'

export type ItemSheetProps = {
  vitrine: PublicVitrine
  item: PublicItem
  onClose: () => void
  cart?: { initial?: CartLine; onSubmit: (line: NewCartLine) => void }
}

export default function ItemSheet({ vitrine, item, onClose, cart }: ItemSheetProps) {
  // Serviços: o CTA abre o agendamento (data, horário e dados do cliente) no próprio popup.
  const isService = !cart && vitrine.type === 'servicos'
  // Produto vendido fora da vitrine: o CTA é um link para a loja, e ele nunca entra na sacola.
  const externalUrl = item.saleMode === 'link' ? item.externalUrl : null
  const [variationId, setVariationId] = useState<string | null>(cart?.initial?.variationId ?? null)
  const [qty, setQty] = useState(cart?.initial?.qty ?? 1)
  const [note, setNote] = useState(cart?.initial?.note ?? '')
  const [missingVariation, setMissingVariation] = useState(false)
  const [sending, setSending] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // O vídeo começa sozinho só na primeira vez; depois, só pelo Play.
  const [videoStarted, setVideoStarted] = useState(false)
  const [booking, setBooking] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const choicesRef = useRef<HTMLFieldSetElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const noteId = useId()

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
  const line: NewCartLine = { itemId: item.id, variationId, qty, note }
  const unitCents = lineUnitCents(line, item)
  const hasChoice = variation !== null
  const showPrice = vitrine.showPrices && !(variation && item.priceType === 'on_request')
  const baseLabel = priceLabel(item, item.variations)
  const headerPrice = hasChoice && unitCents !== null ? formatBRL(unitCents) : formatPriceLabel(baseLabel)
  const originalCents = !hasChoice && baseLabel.kind === 'price' ? baseLabel.originalCents : null
  const hasMedia = vitrine.showMedia && (item.video !== null || images.length > 0)
  const slideCount = (item.video ? 1 : 0) + images.length

  function validate(): boolean {
    if (item.variations.length > 0 && !variation) {
      setMissingVariation(true)
      choicesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return false
    }
    return true
  }

  async function onPrimary() {
    if (!validate()) return
    if (cart) {
      cart.onSubmit({ itemId: item.id, variationId, qty, note: note.trim() })
      return
    }
    if (isService) {
      setBooking(true)
      return
    }

    setSending(true)
    await sendDirect(vitrine, item, {
      variation: variation ? { id: variation.id, name: variation.name } : null,
      note,
    })
    // Se o navegador bloquear a abertura do WhatsApp, o botão volta a funcionar.
    setTimeout(() => setSending(false), 3000)
  }

  function goToSlide(delta: number) {
    const el = galleryRef.current
    if (!el) return
    el.scrollBy({ left: delta * el.clientWidth, behavior: 'smooth' })
  }

  let buttonLabel: string
  if (cart) {
    const verb = cart.initial ? 'Salvar alterações' : 'Adicionar à sacola'
    buttonLabel = vitrine.showPrices && unitCents !== null ? `${verb} · ${formatBRL(unitCents * qty)}` : verb
  } else {
    buttonLabel = item.buttonText ?? vitrine.defaultButtonText
  }
  if (externalUrl && !cart) buttonLabel = item.buttonText ?? 'Comprar agora'
  let disabled = sending
  if (item.soldOut) {
    buttonLabel = isService ? 'Indisponível' : 'Esgotado'
    disabled = true
  } else if (!cart && !isService && !externalUrl && !phone) {
    buttonLabel = 'WhatsApp não configurado'
    disabled = true
  } else if (sending) {
    buttonLabel = 'Abrindo o WhatsApp…'
  }
  const showWhatsAppIcon = !cart && !isService && !externalUrl && !item.soldOut && Boolean(phone)
  const showExternalLink = Boolean(externalUrl) && !cart && !item.soldOut
  const showCalendarIcon = isService && !item.soldOut
  const bodyClassName = `flex flex-col px-5 pb-6 md:col-start-2 md:min-h-0 md:overflow-y-auto md:px-7 md:pt-7 ${hasMedia ? 'pt-5' : 'pt-8'}`
  const footerClassName =
    'sticky bottom-0 z-10 mt-auto flex items-center gap-3 border-t border-line bg-surface px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 md:static md:col-start-2 md:px-7 md:pb-5 md:pt-4'

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-black/55 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(event) => event.stopPropagation()}
        className={`relative flex max-h-[92dvh] w-full animate-sheet-up flex-col overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-surface text-ink shadow-float md:overflow-hidden md:rounded-[1.75rem] ${
          hasMedia
            ? 'md:grid md:h-[min(88dvh,720px)] md:max-h-none md:max-w-[960px] md:grid-cols-2 md:grid-rows-[minmax(0,1fr)_auto]'
            : 'md:max-h-[min(88dvh,760px)] md:max-w-[560px]'
        }`}
      >
        {/* Alça e botão de fechar ficam presos ao topo enquanto o conteúdo rola. */}
        <div className="sticky top-0 z-20 h-0 md:absolute md:inset-x-0">
          <span
            aria-hidden="true"
            className={`absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full md:hidden ${
              hasMedia ? 'bg-white/85 shadow-[0_1px_4px_rgb(0_0_0/0.3)]' : 'bg-line-strong'
            }`}
          />
          <CloseButton buttonRef={closeRef} onClick={onClose} className="absolute right-3 top-3.5" />
        </div>

        {hasMedia ? (
          // No celular, o agendamento ocupa o popup inteiro; no computador as fotos continuam ao lado.
          <div className={`relative shrink-0 bg-black md:row-span-2 md:h-full md:min-h-0 ${booking ? 'max-md:hidden' : ''}`}>
            <div
              ref={galleryRef}
              className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={(event) => {
                const el = event.currentTarget
                setActiveIndex(el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0)
              }}
            >
              {/* Spec 6.3: vídeo primeiro. Fora da vista, o player desmonta (pausa e descarrega). */}
              {item.video ? (
                <div className="aspect-[4/5] max-h-[46dvh] w-full shrink-0 snap-center md:aspect-auto md:h-full md:max-h-none">
                  {activeIndex === 0 ? (
                    <ItemVideo key={item.video.mediaId} video={item.video} autoPlay={!videoStarted} onPlay={() => setVideoStarted(true)} />
                  ) : item.video.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.video.posterUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full bg-black" />
                  )}
                </div>
              ) : null}
              {images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.large}
                  src={image.large}
                  srcSet={`${image.small} ${image.smallWidth}w, ${image.large} ${image.largeWidth}w`}
                  sizes="(min-width: 768px) 480px, 100vw"
                  alt=""
                  className={`aspect-[4/5] max-h-[46dvh] w-full shrink-0 snap-center object-cover md:aspect-auto md:h-full md:max-h-none ${
                    item.soldOut ? 'grayscale' : ''
                  }`}
                />
              ))}
            </div>

            {slideCount > 1 ? (
              <>
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {Array.from({ length: slideCount }, (_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-[width,opacity] duration-300 ease-out-quint ${
                        index === activeIndex ? 'w-5 opacity-100' : 'w-1.5 opacity-60'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Foto anterior"
                  disabled={activeIndex === 0}
                  onClick={() => goToSlide(-1)}
                  className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.2)] transition-opacity duration-150 disabled:opacity-0 md:flex"
                >
                  <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima foto"
                  disabled={activeIndex >= slideCount - 1}
                  onClick={() => goToSlide(1)}
                  className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.2)] transition-opacity duration-150 disabled:opacity-0 md:flex"
                >
                  <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2.5} />
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {booking ? (
          <BookingFlow
            vitrine={vitrine}
            item={item}
            phone={phone}
            priceText={vitrine.showPrices ? headerPrice : null}
            bodyClassName={bodyClassName}
            footerClassName={footerClassName}
            onBack={() => setBooking(false)}
          />
        ) : (
        <>
        <div className={bodyClassName}>
          <h2 className="pr-12 text-2xl font-extrabold leading-tight tracking-[-0.02em] md:text-[1.75rem]">{item.name}</h2>
          {showPrice ? (
            <p className="numeric mt-2 flex flex-wrap items-baseline gap-x-2 text-2xl font-extrabold tracking-[-0.01em]">
              {originalCents !== null ? <s className="text-base font-medium text-ink-muted">{formatBRL(originalCents)}</s> : null}
              <span>{headerPrice}</span>
            </p>
          ) : null}
          {item.durationMinutes ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <Clock aria-hidden="true" className="size-4" strokeWidth={2.5} />
              {item.durationMinutes} min
            </p>
          ) : null}

          {item.soldOut ? (
            <p className="mt-3 w-fit rounded-full bg-ink px-3 py-1 text-sm font-bold text-canvas">
              {isService ? 'Serviço indisponível no momento' : 'Item esgotado no momento'}
            </p>
          ) : null}
          {item.description ? <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-muted">{item.description}</p> : null}
          <TagList tags={item.tags} className="mt-3" />
          {isService && item.notice ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-[0.9375rem] font-medium leading-snug">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--color-accent)" strokeWidth={2.5} />
              {item.notice}
            </p>
          ) : null}

          {item.variations.length > 0 ? (
            <fieldset ref={choicesRef} className="mt-7 min-w-0">
              <legend className="float-left mb-3 flex w-full items-center justify-between gap-3">
                <span className="text-lg font-extrabold tracking-[-0.01em]">Escolha uma opção</span>
                <GroupBadge required>Obrigatório · escolha 1</GroupBadge>
              </legend>
              <div
                className={`clear-both flex flex-col gap-2 rounded-2xl transition-shadow duration-200 ${
                  missingVariation ? 'ring-2 ring-danger ring-offset-4 ring-offset-surface' : ''
                }`}
              >
                {item.variations.map((option) => {
                  const promo = option.promoPriceCents !== null && option.promoPriceCents < option.priceCents
                  return (
                    <label key={option.id} className={optionCardClass}>
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
                        className={optionInputClass}
                      />
                      <OptionMark type="radio" />
                      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="font-semibold">
                          {option.name}
                          {option.soldOut ? <span className="font-medium text-ink-muted"> · Esgotado</span> : null}
                        </span>
                        {vitrine.showPrices && item.priceType !== 'on_request' ? (
                          <span className="numeric flex items-baseline gap-1.5 text-[0.9375rem] font-semibold">
                            {promo ? <s className="text-sm font-medium text-ink-muted">{formatBRL(option.priceCents)}</s> : null}
                            {formatBRL(option.promoPriceCents ?? option.priceCents)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
              {missingVariation ? (
                <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-danger">
                  <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
                  Escolha uma opção.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {/* Serviços pedem a observação junto com os dados, no passo seguinte. */}
          {isService ? null : (
            <div className="mt-7 flex flex-col gap-2">
              <label htmlFor={noteId} className="text-lg font-extrabold tracking-[-0.01em]">
                Observação
              </label>
              <textarea
                id={noteId}
                value={note}
                maxLength={140}
                rows={2}
                placeholder="Algum detalhe? Escreva aqui."
                onChange={(event) => setNote(event.target.value)}
                className={`${fieldClass} h-auto resize-none py-3 leading-snug`}
              />
              <span className="numeric self-end text-xs text-ink-muted">{note.length}/140</span>
            </div>
          )}
        </div>

        <div className={footerClassName}>
          {cart ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-subtle p-1" aria-label="Quantidade" role="group">
              <StepButton
                kind="minus"
                aria-label="Diminuir quantidade"
                disabled={qty <= 1}
                onClick={() => setQty((value) => Math.max(1, value - 1))}
              />
              <span aria-live="polite" className="numeric w-7 text-center text-lg font-bold">
                {qty}
              </span>
              <StepButton
                kind="plus"
                tone="neutral"
                aria-label="Aumentar quantidade"
                disabled={qty >= 99}
                onClick={() => setQty((value) => Math.min(99, value + 1))}
              />
            </div>
          ) : null}
          {showExternalLink ? (
            <a
              href={externalUrl!}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`${brandButtonClass} numeric min-w-0 flex-1 px-4 text-[0.9375rem] leading-tight sm:text-base`}
            >
              <ExternalLink aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.5} />
              {buttonLabel}
            </a>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={onPrimary}
              className={`${brandButtonClass} numeric min-w-0 flex-1 px-4 text-[0.9375rem] leading-tight sm:text-base`}
            >
              {showWhatsAppIcon ? <WhatsAppIcon className="size-5 shrink-0" /> : null}
              {showCalendarIcon ? <CalendarDays aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.5} /> : null}
              {buttonLabel}
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

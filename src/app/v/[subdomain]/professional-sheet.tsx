'use client'

import { UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { PublicItem, PublicProfessional, PublicVitrine } from '@/features/public/build-catalog'
import { formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { CloseButton, SheetHandle } from './vitrine-ui'

/*
 * Caminho "escolhi o profissional primeiro": o popup mostra o que ele faz e, ao
 * escolher o serviço, o agendamento abre já com ele. A agenda consultada passa a ser
 * só a dele.
 */
export default function ProfessionalSheet({
  vitrine,
  professional,
  items,
  onChoose,
  onClose,
}: {
  vitrine: PublicVitrine
  professional: PublicProfessional
  items: PublicItem[]
  onChoose: (item: PublicItem) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

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

  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-black/55 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={professional.name}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.75rem] bg-surface text-ink shadow-float md:max-h-[min(88dvh,720px)] md:max-w-[520px] md:rounded-[1.75rem]"
      >
        <div className="shrink-0 pt-2 md:pt-0">
          <SheetHandle />
          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-3 md:px-7 md:pt-6">
            <div className="flex min-w-0 items-center gap-3">
              {professional.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={professional.photo.small} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-(--color-accent)"
                >
                  <UserRound className="size-7" strokeWidth={2.5} />
                </span>
              )}
              <div className="flex min-w-0 flex-col">
                <h2 className="truncate text-2xl font-extrabold tracking-[-0.02em]">{professional.name}</h2>
                <p className="text-sm font-medium text-ink-muted">Escolha o serviço para ver os horários</p>
              </div>
            </div>
            <CloseButton buttonRef={closeRef} onClick={onClose} />
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-line overflow-y-auto overscroll-contain px-5 pb-6 md:px-7">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoose(item)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover.small} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-bold leading-snug">{item.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
                    {item.durationMinutes ? <span>{item.durationMinutes} min</span> : null}
                    {vitrine.showPrices ? (
                      <span className="numeric font-bold text-ink">{formatPriceLabel(priceLabel(item, item.variations))}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

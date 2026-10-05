'use client'

import { ChevronDown, Clock, MapPin } from 'lucide-react'
import { useId, useState, useSyncExternalStore } from 'react'
import { InstagramIcon } from '@/components/brand/instagram-icon'
import type { PublicVitrine } from '@/features/public/build-catalog'
import { todayHoursLabel, weekSchedule } from '@/lib/vitrines/business-hours'
import type { BusinessHours } from '@/lib/vitrines/service-segments'

const linkClass =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full text-sm font-bold text-ink underline-offset-2 hover:underline'

/*
 * Instagram, endereço e horários no cabeçalho da loja, numa linha que quebra no celular.
 * Cada item só aparece se o dono preencheu.
 */
export function BusinessInfo({ vitrine }: { vitrine: PublicVitrine }) {
  const { instagram, address, businessHours } = vitrine
  if (!instagram && !address && !businessHours) return null

  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {instagram ? (
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className={linkClass}>
            <InstagramIcon className="size-4 shrink-0 text-ink-muted" />@{instagram}
          </a>
        ) : null}
        {address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noreferrer"
            className={`${linkClass} min-w-0`}
          >
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
            <span className="min-w-0 break-words">{address}</span>
          </a>
        ) : null}
      </div>
      {businessHours ? <HoursToggle hours={businessHours} /> : null}
    </div>
  )
}

const noSubscribe = () => () => {}

function HoursToggle({ hours }: { hours: BusinessHours }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  // "Hoje" depende do relógio de quem abre; a página em cache não sabe o dia.
  const today = useSyncExternalStore(noSubscribe, () => todayHoursLabel(hours, new Date()), () => null)

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-bold text-ink"
      >
        <Clock aria-hidden="true" className="size-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
        {today ?? 'Horários'}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>
      <dl id={listId} hidden={!open} className="mt-1 grid max-w-xs grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        {weekSchedule(hours).map(({ day, label, range }) => (
          <div key={day} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={range ? 'font-bold text-ink' : 'text-ink-muted'}>{range ?? 'Fechado'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

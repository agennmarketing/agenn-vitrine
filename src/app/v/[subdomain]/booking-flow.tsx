'use client'

import { ArrowLeft, CalendarCheck, CircleAlert, Clock, Info } from 'lucide-react'
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import {
  EMPTY_BOOKING_CONTACT,
  validateBookingContact,
  type BookingContactErrors,
  type BookingContactInput,
} from '@/lib/booking/booking-request'
import { bookingDateChip, bookingDateLabel } from '@/lib/booking/format'
import { buildBookingMessage, buildWhatsAppUrl } from '@/lib/whatsapp/messages'
import { brandButtonClass, fieldClass, WhatsAppIcon } from './vitrine-ui'

/*
 * Agendamento dentro do popup do serviço: data → horário → nome → WhatsApp →
 * observação → confirmar. A vitrine só recebe datas com horário livre e, depois da
 * escolha da data, os horários livres dela — nunca a agenda.
 */

type Step = 'slot' | 'contact' | 'done'
type Loadable<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }
type Confirmation = { code: string; serviceName: string; date: string; time: string; priceText: string | null }

const LOAD_ERROR = 'Não foi possível carregar a agenda. Tente de novo.'

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(String(response.status))
  return (await response.json()) as T
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[0.9375rem] font-bold">
        {label}
        {hint ? <span className="font-medium text-ink-muted"> {hint}</span> : null}
      </label>
      {children}
      {error ? <ErrorLine>{error}</ErrorLine> : null}
    </div>
  )
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-danger">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
      {children}
    </p>
  )
}

const chipClass =
  'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-line bg-surface font-bold transition-colors duration-150 hover:border-line-strong has-[:checked]:border-(--color-accent) has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent)'
const chipInputClass = 'absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-2xl opacity-0'

export function BookingFlow({
  vitrine,
  item,
  phone,
  priceText,
  bodyClassName,
  footerClassName,
  onBack,
}: {
  vitrine: PublicVitrine
  item: PublicItem
  phone: string | null
  priceText: string | null
  bodyClassName: string
  footerClassName: string
  onBack: () => void
}) {
  const id = useId()
  const [step, setStep] = useState<Step>('slot')
  const [dates, setDates] = useState<Loadable<string[]>>({ status: 'loading' })
  const [date, setDate] = useState<string | null>(null)
  const [times, setTimes] = useState<Loadable<string[]> | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [contact, setContact] = useState<BookingContactInput>(EMPTY_BOOKING_CONTACT)
  const [errors, setErrors] = useState<BookingContactErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const base = `/api/agenda?item=${encodeURIComponent(item.id)}`

  const loadDates = useCallback(async () => {
    setDates({ status: 'loading' })
    try {
      const { dates: list } = await getJson<{ dates: string[] }>(base)
      setDates({ status: 'ready', value: list })
      return list
    } catch {
      setDates({ status: 'error', message: LOAD_ERROR })
      return null
    }
  }, [base])

  const loadTimes = useCallback(
    async (value: string) => {
      setTimes({ status: 'loading' })
      try {
        const { times: list } = await getJson<{ times: string[] }>(`${base}&data=${value}`)
        setTimes({ status: 'ready', value: list })
      } catch {
        setTimes({ status: 'error', message: LOAD_ERROR })
      }
    },
    [base],
  )

  useEffect(() => {
    // Busca inicial das datas livres; o setState acontece depois da resposta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDates()
  }, [loadDates])

  function chooseDate(value: string) {
    setDate(value)
    setTime(null)
    setSlotError(null)
    void loadTimes(value)
  }

  function field(key: keyof BookingContactInput) {
    return {
      id: `${id}-${key}`,
      value: contact[key],
      'aria-invalid': errors[key] ? true : undefined,
      onChange: (event: { target: { value: string } }) => setContact((current) => ({ ...current, [key]: event.target.value })),
    }
  }

  async function confirm() {
    if (!date || !time) return
    const result = validateBookingContact(contact)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setSubmitError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, date, time, ...contact }),
      })
      const body = (await response.json().catch(() => ({}))) as Partial<Confirmation> & { error?: string; fieldErrors?: BookingContactErrors }
      if (response.status === 201 && body.code) {
        setConfirmation(body as Confirmation)
        setStep('done')
      } else if (response.status === 409) {
        // Alguém reservou antes: volta para a escolha com os horários atualizados.
        setStep('slot')
        setTime(null)
        setSlotError(body.error ?? 'Esse horário acabou de ser reservado. Escolha outro.')
        const list = await loadDates()
        if (list?.includes(date)) void loadTimes(date)
        else {
          setDate(null)
          setTimes(null)
        }
      } else if (body.fieldErrors && Object.keys(body.fieldErrors).length > 0) {
        setErrors(body.fieldErrors)
      } else {
        setSubmitError(body.error ?? 'Não foi possível agendar agora. Tente de novo.')
      }
    } catch {
      setSubmitError('Sem conexão. Confira a internet e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <>
      <h2 className="pr-12 text-2xl font-extrabold leading-tight tracking-[-0.02em] md:text-[1.75rem]">{item.name}</h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-ink-muted">
        {item.durationMinutes ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4" strokeWidth={2.5} />
            {item.durationMinutes} min
          </span>
        ) : null}
        {priceText ? <span className="numeric font-bold text-ink">{priceText}</span> : null}
      </p>
    </>
  )

  const notice = item.notice ? (
    <p className="flex items-start gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-[0.9375rem] font-medium leading-snug">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--color-accent)" strokeWidth={2.5} />
      {item.notice}
    </p>
  ) : null

  if (step === 'done' && confirmation) {
    const message = buildBookingMessage({
      vitrineName: vitrine.name,
      serviceName: confirmation.serviceName,
      date: confirmation.date,
      time: confirmation.time,
      priceText: confirmation.priceText,
      customerName: contact.name.trim(),
      code: confirmation.code,
      notes: contact.notes.trim() || null,
    })
    return (
      <>
        <div className={bodyClassName}>
          <div role="status" className="flex flex-col items-center gap-3 pt-2 text-center">
            <span className="flex size-16 animate-pop items-center justify-center rounded-full bg-brand text-brand-ink">
              <CalendarCheck aria-hidden="true" className="size-8" strokeWidth={2.25} />
            </span>
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Horário agendado!</h2>
            <p className="text-ink-muted">Guarde o código do seu agendamento.</p>
          </div>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl bg-subtle px-5 py-4 text-[0.9375rem]">
            <dt className="text-ink-muted">Serviço</dt>
            <dd className="font-bold">{confirmation.serviceName}</dd>
            <dt className="text-ink-muted">Data</dt>
            <dd className="font-bold first-letter:uppercase">{bookingDateLabel(confirmation.date)}</dd>
            <dt className="text-ink-muted">Horário</dt>
            <dd className="numeric font-bold">{confirmation.time}</dd>
            {confirmation.priceText ? (
              <>
                <dt className="text-ink-muted">Valor</dt>
                <dd className="numeric font-bold">{confirmation.priceText}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">Código</dt>
            <dd className="numeric font-extrabold tracking-[0.08em]">#{confirmation.code}</dd>
          </dl>
          {notice ? <div className="mt-4">{notice}</div> : null}
        </div>
        <div className={footerClassName}>
          {phone ? (
            <a href={buildWhatsAppUrl(phone, message)} className={`${brandButtonClass} min-w-0 flex-1 px-4 text-[0.9375rem] sm:text-base`}>
              <WhatsAppIcon className="size-5 shrink-0" />
              Avisar no WhatsApp
            </a>
          ) : null}
        </div>
      </>
    )
  }

  const backButton = (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => (step === 'contact' ? setStep('slot') : onBack())}
      className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-ink transition-transform duration-150 active:scale-95"
    >
      <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.5} />
    </button>
  )

  if (step === 'contact' && date && time) {
    return (
      <>
        <div className={bodyClassName}>
          {header}
          <p className="mt-4 rounded-2xl bg-subtle px-4 py-3 font-bold first-letter:uppercase">
            {bookingDateLabel(date)} às <span className="numeric">{time}</span>
          </p>
          <div className="mt-5 flex flex-col gap-5">
            <Field label="Nome" htmlFor={`${id}-name`} error={errors.name}>
              <input {...field('name')} className={fieldClass} maxLength={60} autoComplete="name" />
            </Field>
            <Field label="WhatsApp" htmlFor={`${id}-whatsapp`} error={errors.whatsapp}>
              <input
                {...field('whatsapp')}
                className={fieldClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
              />
            </Field>
            <Field label="Observação" hint="(opcional)" htmlFor={`${id}-notes`} error={errors.notes}>
              <textarea
                {...field('notes')}
                rows={3}
                maxLength={300}
                placeholder="Algum detalhe? Escreva aqui."
                className={`${fieldClass} h-auto resize-none py-3 leading-snug`}
              />
            </Field>
            {notice}
            {submitError ? <ErrorLine>{submitError}</ErrorLine> : null}
          </div>
        </div>
        <div className={footerClassName}>
          {backButton}
          <button
            type="button"
            disabled={submitting}
            onClick={confirm}
            className={`${brandButtonClass} min-w-0 flex-1 px-4 text-[0.9375rem] leading-tight sm:text-base`}
          >
            {submitting ? 'Agendando…' : 'Confirmar agendamento'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className={bodyClassName}>
        {header}
        {slotError ? <div className="mt-4"><ErrorLine>{slotError}</ErrorLine></div> : null}

        <fieldset className="mt-6 min-w-0">
          <legend className="mb-3 text-lg font-extrabold tracking-[-0.01em]">Escolha a data</legend>
          {dates.status === 'loading' ? (
            <p className="text-ink-muted">Carregando datas…</p>
          ) : dates.status === 'error' ? (
            <ErrorLine>{dates.message}</ErrorLine>
          ) : dates.value.length === 0 ? (
            <p className="rounded-2xl bg-subtle px-4 py-3 text-ink-muted">
              Nenhum horário disponível nos próximos dias. Fale com a gente pelo WhatsApp.
            </p>
          ) : (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:-mx-7 md:px-7 [&::-webkit-scrollbar]:hidden">
              {dates.value.map((value) => {
                const chip = bookingDateChip(value)
                return (
                  <label key={value} className={`${chipClass} h-16 w-16 shrink-0`}>
                    <input
                      type="radio"
                      name={`${id}-date`}
                      value={value}
                      checked={date === value}
                      onChange={() => chooseDate(value)}
                      aria-label={bookingDateLabel(value)}
                      className={chipInputClass}
                    />
                    <span className="text-xs font-semibold text-ink-muted">{chip.weekday}</span>
                    <span className="numeric text-[0.9375rem]">{chip.day}</span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>

        {date && times ? (
          <fieldset className="mt-6 min-w-0">
            <legend className="mb-3 text-lg font-extrabold tracking-[-0.01em]">Escolha o horário</legend>
            {times.status === 'loading' ? (
              <p className="text-ink-muted">Carregando horários…</p>
            ) : times.status === 'error' ? (
              <ErrorLine>{times.message}</ErrorLine>
            ) : times.value.length === 0 ? (
              <p className="rounded-2xl bg-subtle px-4 py-3 text-ink-muted">Os horários desta data acabaram. Escolha outra data.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {times.value.map((value) => (
                  <label key={value} className={`${chipClass} h-12`}>
                    <input
                      type="radio"
                      name={`${id}-time`}
                      value={value}
                      checked={time === value}
                      onChange={() => {
                        setTime(value)
                        setSlotError(null)
                      }}
                      aria-label={value}
                      className={chipInputClass}
                    />
                    <span className="numeric">{value}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : null}
      </div>
      <div className={footerClassName}>
        {backButton}
        <button
          type="button"
          disabled={!date || !time}
          onClick={() => setStep('contact')}
          className={`${brandButtonClass} min-w-0 flex-1 px-4 text-[0.9375rem] leading-tight sm:text-base`}
        >
          Continuar
        </button>
      </div>
    </>
  )
}

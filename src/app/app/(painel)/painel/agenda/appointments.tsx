'use client'

import { CalendarClock, CalendarX2, CircleCheck, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { cancelAppointmentAction, completeAppointmentAction, rescheduleAppointmentAction } from '@/features/booking/actions'
import { addDays, saoPauloDate } from '@/lib/booking/availability'
import { bookingDateLabel } from '@/lib/booking/format'
import type { FormState } from '@/lib/forms/form-state'
import { buildWhatsAppUrl } from '@/lib/whatsapp/messages'

export type AppointmentRow = {
  id: string
  code: string
  serviceName: string
  priceText: string | null
  customerName: string
  phone: string
  phoneLabel: string
  notes: string | null
  /** Início (ISO): só o que já começou pode ser concluído. */
  startsAt: string
  date: string
  start: string
  end: string
}

function dayTitle(date: string, today: string) {
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  if (date === addDays(today, -1)) return 'Ontem'
  const label = bookingDateLabel(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Nova data e horário, escolhidos livremente pelo dono; o banco confere bloqueios e outros agendamentos.
function RescheduleForm({
  vitrineId,
  appointment,
  onDone,
}: {
  vitrineId: string
  appointment: AppointmentRow
  onDone: (result: FormState) => void
}) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await rescheduleAppointmentAction(vitrineId, appointment.id, prev, formData)
    if (result.success) onDone(result)
    return result
  }, {})
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3 rounded-control bg-subtle p-3 sm:basis-full">
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Field label="Nova data" htmlFor={`date-${appointment.id}`} error={errors.date}>
          <Input
            id={`date-${appointment.id}`}
            name="date"
            type="date"
            min={saoPauloDate(new Date())}
            defaultValue={state.values?.date ?? appointment.date}
            invalid={!!errors.date}
          />
        </Field>
        <Field label="Novo horário" htmlFor={`time-${appointment.id}`} error={errors.time}>
          <Input
            id={`time-${appointment.id}`}
            name="time"
            type="time"
            step={300}
            defaultValue={state.values?.time ?? appointment.start}
            invalid={!!errors.time}
          />
        </Field>
      </div>
      <FormMessage error={state.error} />
      <span className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner /> : null}
          Salvar novo horário
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => onDone({})}>
          Voltar
        </Button>
      </span>
    </form>
  )
}

export function Appointments({
  vitrineId,
  appointments,
  editable,
  emptyText,
}: {
  vitrineId: string
  appointments: AppointmentRow[]
  /** Hoje e Próximos: concluir, remarcar e cancelar. Concluídos e Cancelados só mostram. */
  editable: boolean
  emptyText: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState<{ id: string; mode: 'cancel' | 'reschedule' } | null>(null)
  const [result, setResult] = useState<FormState>({})
  const now = new Date()
  const today = saoPauloDate(now)

  const days = new Map<string, AppointmentRow[]>()
  for (const appointment of appointments) days.set(appointment.date, [...(days.get(appointment.date) ?? []), appointment])

  function finish(outcome: FormState) {
    setResult(outcome)
    setOpen(null)
    if (outcome.success) router.refresh()
  }

  function run(action: typeof cancelAppointmentAction, id: string) {
    startTransition(async () => finish(await action(vitrineId, id)))
  }

  return (
    <div className="flex flex-col gap-4">
      <FormMessage error={result.error} success={result.success} />
      {appointments.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-8 text-center font-bold text-ink-muted">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...days].map(([date, list]) => (
            <section key={date} aria-label={dayTitle(date, today)} className="flex flex-col gap-2.5">
              <h3 className="text-sm font-black uppercase tracking-[0.06em] text-ink-muted">{dayTitle(date, today)}</h3>
              <ul className="flex flex-col gap-2.5">
                {list.map((appointment) => {
                  const mode = open?.id === appointment.id ? open.mode : null
                  return (
                    <li
                      key={appointment.id}
                      className="flex flex-col gap-3 rounded-control border-2 border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-start"
                    >
                      <span className="numeric w-24 shrink-0 text-lg font-black text-ink">
                        {appointment.start}
                        <span className="block text-sm font-bold text-ink-muted">até {appointment.end}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-extrabold text-ink">{appointment.customerName}</span>
                        <span className="font-bold text-ink">{appointment.serviceName}</span>
                        <a
                          href={buildWhatsAppUrl(appointment.phone, `Olá, ${appointment.customerName}!`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-1.5 text-sm font-extrabold text-go-strong underline-offset-2 hover:underline"
                        >
                          <MessageCircle aria-hidden="true" className="size-4" strokeWidth={2.5} />
                          {appointment.phoneLabel}
                        </a>
                        {appointment.notes ? (
                          <span className="text-sm font-semibold text-ink-muted">Obs.: {appointment.notes}</span>
                        ) : null}
                        <span className="text-xs font-bold text-ink-muted">
                          #{appointment.code}
                          {appointment.priceText ? ` · ${appointment.priceText}` : ''}
                        </span>
                      </span>
                      {!editable || mode === 'reschedule' ? null : mode === 'cancel' ? (
                        <span className="flex shrink-0 gap-2">
                          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(cancelAppointmentAction, appointment.id)}>
                            Confirmar cancelamento
                          </Button>
                          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setOpen(null)}>
                            Manter
                          </Button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 flex-wrap gap-2">
                          {new Date(appointment.startsAt) > now ? null : (
                            <Button
                              size="sm"
                              disabled={pending}
                              aria-label={`Concluir atendimento de ${appointment.customerName} às ${appointment.start}`}
                              onClick={() => run(completeAppointmentAction, appointment.id)}
                            >
                              <CircleCheck aria-hidden="true" className="size-4" strokeWidth={2.5} />
                              Concluir
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Remarcar agendamento de ${appointment.customerName} às ${appointment.start}`}
                            onClick={() => setOpen({ id: appointment.id, mode: 'reschedule' })}
                          >
                            <CalendarClock aria-hidden="true" className="size-4" strokeWidth={2.5} />
                            Remarcar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Cancelar agendamento de ${appointment.customerName} às ${appointment.start}`}
                            onClick={() => setOpen({ id: appointment.id, mode: 'cancel' })}
                          >
                            <CalendarX2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                            Cancelar
                          </Button>
                        </span>
                      )}
                      {mode === 'reschedule' ? (
                        <RescheduleForm vitrineId={vitrineId} appointment={appointment} onDone={finish} />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

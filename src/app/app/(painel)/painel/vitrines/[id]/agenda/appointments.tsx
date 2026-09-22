'use client'

import { CalendarX2, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfigBlock } from '@/components/ui/config-section'
import { FormMessage } from '@/components/ui/form-message'
import { cancelAppointmentAction } from '@/features/booking/actions'
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
  date: string
  start: string
  end: string
}

function dayTitle(date: string, today: string) {
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  const label = bookingDateLabel(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function Appointments({ vitrineId, appointments }: { vitrineId: string; appointments: AppointmentRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [result, setResult] = useState<FormState>({})
  const today = saoPauloDate(new Date())

  const days = new Map<string, AppointmentRow[]>()
  for (const appointment of appointments) days.set(appointment.date, [...(days.get(appointment.date) ?? []), appointment])

  function cancel(id: string) {
    startTransition(async () => {
      const outcome = await cancelAppointmentAction(vitrineId, id)
      setResult(outcome)
      setConfirming(null)
      if (!outcome.error) router.refresh()
    })
  }

  return (
    <ConfigBlock title="Próximos agendamentos" description="Cancelar libera o horário na vitrine na mesma hora.">
      <FormMessage error={result.error} success={result.success} />
      {appointments.length === 0 ? (
        <p className="rounded-control bg-subtle px-4 py-5 text-center font-bold text-ink-muted">
          Nenhum agendamento por enquanto. Divulgue o link da vitrine para começar a receber.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...days].map(([date, list]) => (
            <section key={date} aria-label={dayTitle(date, today)} className="flex flex-col gap-2.5">
              <h4 className="text-sm font-black uppercase tracking-[0.06em] text-ink-muted">{dayTitle(date, today)}</h4>
              <ul className="flex flex-col gap-2.5">
                {list.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-col gap-3 rounded-control border-2 border-line bg-surface p-4 sm:flex-row sm:items-start"
                  >
                    <span className="numeric w-24 shrink-0 text-lg font-black text-ink">
                      {appointment.start}
                      <span className="block text-sm font-bold text-ink-muted">até {appointment.end}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-extrabold text-ink">{appointment.serviceName}</span>
                      <span className="font-bold text-ink">{appointment.customerName}</span>
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
                    {confirming === appointment.id ? (
                      <span className="flex shrink-0 gap-2">
                        <Button size="sm" variant="danger" disabled={pending} onClick={() => cancel(appointment.id)}>
                          Confirmar cancelamento
                        </Button>
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(null)}>
                          Manter
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        aria-label={`Cancelar agendamento de ${appointment.customerName} às ${appointment.start}`}
                        onClick={() => setConfirming(appointment.id)}
                      >
                        <CalendarX2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                        Cancelar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ConfigBlock>
  )
}

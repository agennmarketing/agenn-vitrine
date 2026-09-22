'use client'

import { useActionState, useState } from 'react'
import { BusinessHoursEditor } from '@/components/ui/business-hours-editor'
import { Button } from '@/components/ui/button'
import { ConfigBlock } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Select } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { saveBookingRulesAction } from '@/features/booking/actions'
import { BUFFER_OPTIONS, MAX_DAYS_OPTIONS, MIN_NOTICE_OPTIONS } from '@/lib/booking/rules'
import type { FormState } from '@/lib/forms/form-state'
import type { BusinessHours } from '@/lib/vitrines/service-segments'

type Initial = { hours: BusinessHours; bufferMinutes: number; minNoticeMinutes: number; maxDaysAhead: number }

function noticeLabel(minutes: number) {
  if (minutes === 0) return 'Sem antecedência'
  if (minutes < 60) return `${minutes} minutos antes`
  if (minutes < 1440) return `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'} antes`
  return `${minutes / 1440} ${minutes === 1440 ? 'dia' : 'dias'} antes`
}

export function RulesForm({ vitrineId, initial }: { vitrineId: string; initial: Initial }) {
  const [hours, setHours] = useState<BusinessHours>(initial.hours)
  const [state, formAction, pending] = useActionState(
    (prev: FormState, formData: FormData) => saveBookingRulesAction(vitrineId, prev, formData),
    {},
  )
  const errors = state.fieldErrors ?? {}
  const values = state.values

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <ConfigBlock title="Dias e horários de atendimento" description="Os horários livres saem daqui, de 30 em 30 minutos.">
        <input type="hidden" name="businessHours" value={JSON.stringify(hours)} />
        <BusinessHoursEditor hours={hours} onChange={setHours} />
        <FormMessage error={errors.businessHours} />
      </ConfigBlock>

      <ConfigBlock title="Regras dos agendamentos">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Intervalo entre atendimentos"
            htmlFor="bufferMinutes"
            error={errors.bufferMinutes}
            hint="Somado à duração do serviço."
          >
            <Select id="bufferMinutes" name="bufferMinutes" defaultValue={values?.bufferMinutes ?? String(initial.bufferMinutes)}>
              {BUFFER_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? 'Sem intervalo' : `${minutes} min`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Antecedência mínima" htmlFor="minNoticeMinutes" error={errors.minNoticeMinutes}>
            <Select
              id="minNoticeMinutes"
              name="minNoticeMinutes"
              defaultValue={values?.minNoticeMinutes ?? String(initial.minNoticeMinutes)}
            >
              {MIN_NOTICE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {noticeLabel(minutes)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Agendar até" htmlFor="maxDaysAhead" error={errors.maxDaysAhead}>
            <Select id="maxDaysAhead" name="maxDaysAhead" defaultValue={values?.maxDaysAhead ?? String(initial.maxDaysAhead)}>
              {MAX_DAYS_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} dias à frente
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </ConfigBlock>

      <div className="flex flex-col gap-3">
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full lg:w-auto lg:self-start">
          {pending ? <Spinner /> : null}
          Salvar regras da agenda
        </Button>
      </div>
    </form>
  )
}

'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfigBlock } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { addBookingBlockAction, removeBookingBlockAction } from '@/features/booking/actions'
import { addDays, saoPauloDate } from '@/lib/booking/availability'
import { dayMonth } from '@/lib/booking/format'
import type { FormState } from '@/lib/forms/form-state'

export type BlockRow = { id: string; reason: string | null; startDate: string; startTime: string; endDate: string; endTime: string }

function blockLabel(block: BlockRow) {
  if (block.startTime === '00:00' && block.endTime === '00:00') {
    const lastDay = addDays(block.endDate, -1)
    return lastDay === block.startDate ? `${dayMonth(block.startDate)}, dia inteiro` : `${dayMonth(block.startDate)} a ${dayMonth(lastDay)}`
  }
  if (block.startDate === block.endDate) return `${dayMonth(block.startDate)}, das ${block.startTime} às ${block.endTime}`
  return `${dayMonth(block.startDate)} ${block.startTime} a ${dayMonth(block.endDate)} ${block.endTime}`
}

export function Blocks({
  vitrineId,
  blocks,
  yourPlace,
  blockExample,
}: {
  vitrineId: string
  blocks: BlockRow[]
  /** Palavras do segmento: "seu studio", "Folga". */
  yourPlace: string
  blockExample: string
}) {
  const router = useRouter()
  const [allDay, setAllDay] = useState(true)
  const [pending, startTransition] = useTransition()
  const [removal, setRemoval] = useState<FormState>({})
  const [formKey, setFormKey] = useState(0)
  const [state, formAction, adding] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addBookingBlockAction(vitrineId, prev, formData)
    if (result.success) {
      setFormKey((key) => key + 1)
      router.refresh()
    }
    return result
  }, {})
  const errors = state.fieldErrors ?? {}
  const values = state.values

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeBookingBlockAction(vitrineId, id)
      setRemoval(result)
      if (!result.error) router.refresh()
    })
  }

  return (
    <ConfigBlock
      title="Bloquear datas e horários específicos"
      description={`Bloqueie intervalos (como almoço), folgas e feriados em que ${yourPlace} não atende para não ficarem disponíveis para agendamento online.`}
    >
      <form key={formKey} action={formAction} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data" htmlFor="block-date" error={errors.date}>
            <Input
              id="block-date"
              name="date"
              type="date"
              min={saoPauloDate(new Date())}
              defaultValue={values?.date ?? ''}
              invalid={!!errors.date}
            />
          </Field>
          <Field label="Motivo (opcional)" htmlFor="block-reason" error={errors.reason}>
            <Input
              id="block-reason"
              name="reason"
              maxLength={80}
              placeholder={`Ex.: Almoço, folga ou ${blockExample.toLowerCase()}`}
              defaultValue={values?.reason ?? ''}
              invalid={!!errors.reason}
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-3 font-extrabold text-ink">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="size-5 shrink-0 accent-go-strong"
          />
          Dia inteiro
        </label>
        {allDay ? null : (
          <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
            <Field label="Das" htmlFor="block-start" error={errors.start}>
              <Input id="block-start" name="start" type="time" defaultValue={values?.start ?? '12:00'} invalid={!!errors.start} />
            </Field>
            <Field label="Às" htmlFor="block-end" error={errors.end}>
              <Input id="block-end" name="end" type="time" defaultValue={values?.end ?? '13:00'} invalid={!!errors.end} />
            </Field>
          </div>
        )}
        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" variant="secondary" disabled={adding} className="w-full sm:w-auto sm:self-start">
          {adding ? <Spinner /> : null}
          Adicionar bloqueio
        </Button>
      </form>

      {blocks.length > 0 ? (
        <ul className="flex flex-col divide-y-2 divide-line rounded-control border-2 border-line">
          {blocks.map((block) => (
            <li key={block.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold text-ink">{blockLabel(block)}</span>
                {block.reason ? <span className="text-sm font-semibold text-ink-muted">{block.reason}</span> : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-label={`Remover bloqueio de ${blockLabel(block)}`}
                onClick={() => remove(block.id)}
              >
                <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <FormMessage error={removal.error} success={removal.success} />
    </ConfigBlock>
  )
}

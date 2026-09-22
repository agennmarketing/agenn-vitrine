'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { addDays, saoPauloInstant } from '@/lib/booking/availability'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { appointmentRescheduleSchema, bookingBlockSchema, bookingRulesSchema } from '@/lib/vitrines/schemas'

// Tudo pelo cliente do usuário: RLS e grants garantem que só o dono mexe na agenda.
async function ownedServiceVitrine(vitrineId: string) {
  const session = await requireActionUser()
  const { data: vitrine } = await session.supabase
    .from('vitrines')
    .select('id, type')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine || vitrine.type !== 'servicos') redirect('/painel')
  return session
}

export async function saveBookingRulesAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['businessHours', 'bufferMinutes', 'minNoticeMinutes', 'maxDaysAhead'])
  const parsed = bookingRulesSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase } = await ownedServiceVitrine(vitrineId)
  const { error } = await supabase
    .from('vitrines')
    .update({
      business_hours: parsed.data.businessHours,
      booking_buffer_minutes: parsed.data.bufferMinutes,
      booking_min_notice_minutes: parsed.data.minNoticeMinutes,
      booking_max_days_ahead: parsed.data.maxDaysAhead,
    })
    .eq('id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  return { success: 'Regras da agenda salvas.', values: fields }
}

export async function addBookingBlockAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['date', 'allDay', 'start', 'end', 'reason'])
  const parsed = bookingBlockSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const block = parsed.data

  const { supabase } = await ownedServiceVitrine(vitrineId)
  const startsAt = saoPauloInstant(block.date, block.allDay ? '00:00' : block.start)
  const endsAt = block.allDay ? saoPauloInstant(addDays(block.date, 1), '00:00') : saoPauloInstant(block.date, block.end)
  const { error } = await supabase.from('booking_blocks').insert({
    vitrine_id: vitrineId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: block.reason,
  })
  if (error) return { error: mapDbError(error), values: fields }
  return { success: 'Bloqueio adicionado.' }
}

export async function removeBookingBlockAction(vitrineId: string, blockId: string): Promise<FormState> {
  const { supabase } = await ownedServiceVitrine(vitrineId)
  const { error } = await supabase.from('booking_blocks').delete().eq('id', blockId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  return { success: 'Bloqueio removido.' }
}

export async function cancelAppointmentAction(vitrineId: string, appointmentId: string): Promise<FormState> {
  const { supabase } = await ownedServiceVitrine(vitrineId)
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('vitrine_id', vitrineId)
    .eq('status', 'confirmed')
  if (error) return { error: mapDbError(error) }
  return { success: 'Agendamento cancelado. O horário voltou a ficar livre.' }
}

// Só conclui o que já começou: concluir libera o horário na vitrine.
export async function completeAppointmentAction(vitrineId: string, appointmentId: string): Promise<FormState> {
  const { supabase } = await ownedServiceVitrine(vitrineId)
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('vitrine_id', vitrineId)
    .eq('status', 'confirmed')
    .lte('starts_at', new Date().toISOString())
    .select('id')
  if (error) return { error: mapDbError(error) }
  if (data.length === 0) return { error: 'Só dá para concluir um atendimento depois do horário marcado.' }
  return { success: 'Atendimento concluído.' }
}

// Remarcar confere bloqueios e outros agendamentos no banco (reschedule_appointment).
export async function rescheduleAppointmentAction(
  vitrineId: string,
  appointmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ['date', 'time'])
  const parsed = appointmentRescheduleSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase } = await ownedServiceVitrine(vitrineId)
  const { error } = await supabase.rpc('reschedule_appointment', {
    p_appointment_id: appointmentId,
    p_starts_at: saoPauloInstant(parsed.data.date, parsed.data.time).toISOString(),
  })
  if (error) return { error: mapDbError(error), values: fields }
  return { success: 'Agendamento remarcado.' }
}

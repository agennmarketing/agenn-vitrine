import { redirect } from 'next/navigation'
import { SectionIntro } from '@/components/ui/config-section'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { saoPauloDate, saoPauloInstant, saoPauloTime } from '@/lib/booking/availability'
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from '@/lib/vitrines/service-segments'
import { formatPhone } from '@/lib/whatsapp/phone'
import { Appointments } from './appointments'
import { Blocks } from './blocks'
import { RulesForm } from './rules-form'

export const metadata = { title: 'Agenda' }

export default async function AgendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  if (vitrine.type !== 'servicos') redirect(`/painel/vitrines/${id}/itens`)
  const { supabase } = await getPanelSession()
  const now = new Date()
  const today = saoPauloInstant(saoPauloDate(now), '00:00').toISOString()

  const [appointments, blocks] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, code, service_name, price_text, customer_name, customer_phone, notes, starts_at, ends_at')
      .eq('vitrine_id', id)
      .eq('status', 'confirmed')
      .gte('starts_at', today)
      .order('starts_at')
      .limit(200),
    supabase
      .from('booking_blocks')
      .select('id, starts_at, ends_at, reason')
      .eq('vitrine_id', id)
      .gt('ends_at', now.toISOString())
      .order('starts_at'),
  ])
  if (appointments.error) throw appointments.error
  if (blocks.error) throw blocks.error

  const hours = Array.isArray(vitrine.business_hours) ? (vitrine.business_hours as BusinessHours) : DEFAULT_BUSINESS_HOURS

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <SectionIntro
        title="Agenda"
        description="Os agendamentos feitos pela vitrine entram aqui sozinhos. Os clientes só veem os horários livres."
      />
      <Appointments
        vitrineId={id}
        appointments={(appointments.data ?? []).map((row) => ({
          id: row.id,
          code: row.code,
          serviceName: row.service_name,
          priceText: row.price_text,
          customerName: row.customer_name,
          phone: row.customer_phone,
          phoneLabel: formatPhone(row.customer_phone),
          notes: row.notes,
          date: saoPauloDate(new Date(row.starts_at)),
          start: saoPauloTime(new Date(row.starts_at)),
          end: saoPauloTime(new Date(row.ends_at)),
        }))}
      />
      <RulesForm
        vitrineId={id}
        initial={{
          hours,
          bufferMinutes: vitrine.booking_buffer_minutes,
          minNoticeMinutes: vitrine.booking_min_notice_minutes,
          maxDaysAhead: vitrine.booking_max_days_ahead,
        }}
      />
      <Blocks
        vitrineId={id}
        blocks={(blocks.data ?? []).map((row) => {
          const start = new Date(row.starts_at)
          const end = new Date(row.ends_at)
          return {
            id: row.id,
            reason: row.reason,
            startDate: saoPauloDate(start),
            startTime: saoPauloTime(start),
            endDate: saoPauloDate(end),
            endTime: saoPauloTime(end),
          }
        })}
      />
    </div>
  )
}

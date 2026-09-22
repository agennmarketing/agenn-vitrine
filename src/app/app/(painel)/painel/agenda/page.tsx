import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { getMyVitrine, getPanelSession, listMyVitrines } from '@/features/vitrines/queries'
import { addDays, saoPauloDate, saoPauloInstant, saoPauloTime } from '@/lib/booking/availability'
import { bookingDateLabel } from '@/lib/booking/format'
import { DEFAULT_BUSINESS_HOURS, segmentCopy, type BusinessHours } from '@/lib/vitrines/service-segments'
import { formatPhone } from '@/lib/whatsapp/phone'
import { Appointments, type AppointmentRow } from './appointments'
import { Blocks } from './blocks'
import { RulesForm } from './rules-form'

export const metadata = { title: 'Agenda' }

const TABS = [
  { slug: 'hoje', label: 'Hoje' },
  { slug: 'proximos', label: 'Próximos' },
  { slug: 'concluidos', label: 'Concluídos' },
  { slug: 'cancelados', label: 'Cancelados' },
] as const
type Tab = (typeof TABS)[number]['slug']

const SELECT = 'id, code, service_name, price_text, customer_name, customer_phone, notes, starts_at, ends_at'

type Row = {
  id: string
  code: string
  service_name: string
  price_text: string | null
  customer_name: string
  customer_phone: string
  notes: string | null
  starts_at: string
  ends_at: string
}

function toAppointment(row: Row): AppointmentRow {
  return {
    id: row.id,
    code: row.code,
    serviceName: row.service_name,
    priceText: row.price_text,
    customerName: row.customer_name,
    phone: row.customer_phone,
    phoneLabel: formatPhone(row.customer_phone),
    notes: row.notes,
    startsAt: row.starts_at,
    date: saoPauloDate(new Date(row.starts_at)),
    start: saoPauloTime(new Date(row.starts_at)),
    end: saoPauloTime(new Date(row.ends_at)),
  }
}

// Agenda da vitrine de serviços (uma por conta): agendamentos por situação, bloqueios e horários.
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const [first] = await listMyVitrines()
  if (!first) redirect('/painel')
  if (first.type !== 'servicos') redirect(`/painel/vitrines/${first.id}/itens`)
  const id = first.id

  const { aba } = await searchParams
  const tab: Tab = TABS.some((item) => item.slug === aba) ? (aba as Tab) : 'hoje'
  const [vitrine, { supabase }] = await Promise.all([getMyVitrine(id), getPanelSession()])
  const copy = segmentCopy(vitrine.service_segment)
  const now = new Date()
  const today = saoPauloDate(now)
  const tomorrowStart = saoPauloInstant(addDays(today, 1), '00:00')

  const history = tab === 'concluidos' ? 'completed' : tab === 'cancelados' ? 'cancelled' : null
  const [confirmed, past, blocks] = await Promise.all([
    // Confirmados de qualquer data: os de dias anteriores ficam em Hoje até serem concluídos ou cancelados.
    supabase.from('appointments').select(SELECT).eq('vitrine_id', id).eq('status', 'confirmed').order('starts_at').limit(300),
    history
      ? supabase
          .from('appointments')
          .select(SELECT)
          .eq('vitrine_id', id)
          .eq('status', history)
          .order('starts_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as Row[], error: null }),
    supabase
      .from('booking_blocks')
      .select('id, starts_at, ends_at, reason')
      .eq('vitrine_id', id)
      .gt('ends_at', now.toISOString())
      .order('starts_at'),
  ])
  if (confirmed.error) throw confirmed.error
  if (past.error) throw past.error
  if (blocks.error) throw blocks.error

  const confirmedRows = confirmed.data ?? []
  const todayRows = confirmedRows.filter((row) => new Date(row.starts_at) < tomorrowStart)
  const upcomingRows = confirmedRows.filter((row) => new Date(row.starts_at) >= tomorrowStart)
  const counts: Partial<Record<Tab, number>> = { hoje: todayRows.length, proximos: upcomingRows.length }
  const rows = tab === 'hoje' ? todayRows : tab === 'proximos' ? upcomingRows : (past.data ?? [])

  const empty = {
    hoje: 'Nada marcado para hoje.',
    proximos: `Nenhum agendamento por enquanto. Divulgue o link da vitrine e ${copy.yourPlace} começa a receber horários marcados.`,
    concluidos: 'Os atendimentos concluídos aparecem aqui.',
    cancelados: 'Os agendamentos cancelados aparecem aqui.',
  }[tab]

  const hours = Array.isArray(vitrine.business_hours) ? (vitrine.business_hours as BusinessHours) : DEFAULT_BUSINESS_HOURS
  const todayLabel = bookingDateLabel(today)

  return (
    <>
      <PanelTopBar title="Agenda" subtitle={`${copy.place} · ${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)}`} />
      <PanelBody>
        <div className="flex max-w-3xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <nav aria-label="Situação dos agendamentos" className="-mx-4 lg:mx-0">
              <ul className="flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] lg:px-0 [&::-webkit-scrollbar]:hidden">
                {TABS.map(({ slug, label }) => {
                  const active = slug === tab
                  const count = counts[slug]
                  return (
                    <li key={slug} className="shrink-0">
                      <Link
                        href={slug === 'hoje' ? '/painel/agenda' : `/painel/agenda?aba=${slug}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full border-2 bg-surface px-3.5 text-[0.9375rem] font-extrabold transition-colors duration-150 ease-out-quint ${
                          active ? 'border-go-strong text-go-strong' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                        }`}
                      >
                        {label}
                        {count ? (
                          <span className="numeric rounded-full bg-go-soft px-2 text-sm text-go-strong">{count}</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
            <Appointments
              key={tab}
              vitrineId={id}
              editable={tab === 'hoje' || tab === 'proximos'}
              emptyText={empty}
              appointments={rows.map(toAppointment)}
            />
          </div>
          <Blocks
            vitrineId={id}
            yourPlace={copy.yourPlace}
            blockExample={copy.blockExample}
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
          <RulesForm
            vitrineId={id}
            initial={{
              hours,
              bufferMinutes: vitrine.booking_buffer_minutes,
              minNoticeMinutes: vitrine.booking_min_notice_minutes,
              maxDaysAhead: vitrine.booking_max_days_ahead,
            }}
          />
        </div>
      </PanelBody>
    </>
  )
}

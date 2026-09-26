import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'
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

const MAIN_TABS = [
  { slug: 'agendamentos', label: 'Agendamentos', Icon: CalendarDays },
  { slug: 'configurar', label: 'Configurar agenda', Icon: SlidersHorizontal },
] as const
type MainTab = (typeof MAIN_TABS)[number]['slug']

const STATUS_TABS = [
  { slug: 'hoje', label: 'Hoje' },
  { slug: 'proximos', label: 'Próximos' },
  { slug: 'concluidos', label: 'Concluídos' },
  { slug: 'cancelados', label: 'Cancelados' },
] as const
type StatusTab = (typeof STATUS_TABS)[number]['slug']

const SELECT =
  'id, code, service_name, professional_name, price_text, customer_name, customer_phone, notes, starts_at, ends_at'

type Row = {
  id: string
  code: string
  service_name: string
  professional_name: string | null
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
    professionalName: row.professional_name,
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

// Agenda da vitrine de serviços: 2 abas (Agendamentos e Configurar agenda).
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; secao?: string }>
}) {
  const [first] = await listMyVitrines()
  if (!first) redirect('/painel')
  if (first.type !== 'servicos') redirect(`/painel/vitrines/${first.id}/itens`)
  const id = first.id

  const { aba, secao } = await searchParams
  const isConfig = secao === 'configurar' || aba === 'configurar'
  const mainTab: MainTab = isConfig ? 'configurar' : 'agendamentos'
  const statusTab: StatusTab = STATUS_TABS.some((item) => item.slug === aba) ? (aba as StatusTab) : 'hoje'

  const [vitrine, { supabase }] = await Promise.all([getMyVitrine(id), getPanelSession()])
  const copy = segmentCopy(vitrine.service_segment)
  const now = new Date()
  const today = saoPauloDate(now)
  const tomorrowStart = saoPauloInstant(addDays(today, 1), '00:00')

  const history = statusTab === 'concluidos' ? 'completed' : statusTab === 'cancelados' ? 'cancelled' : null
  const [confirmed, past, blocks] = await Promise.all([
    // Confirmados de qualquer data: só busca na aba de agendamentos
    mainTab === 'agendamentos'
      ? supabase.from('appointments').select(SELECT).eq('vitrine_id', id).eq('status', 'confirmed').order('starts_at').limit(300)
      : Promise.resolve({ data: [] as Row[], error: null }),
    mainTab === 'agendamentos' && history
      ? supabase
          .from('appointments')
          .select(SELECT)
          .eq('vitrine_id', id)
          .eq('status', history)
          .order('starts_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as Row[], error: null }),
    mainTab === 'configurar'
      ? supabase
          .from('booking_blocks')
          .select('id, starts_at, ends_at, reason')
          .eq('vitrine_id', id)
          .gt('ends_at', now.toISOString())
          .order('starts_at')
      : Promise.resolve({ data: [] as { id: string; starts_at: string; ends_at: string; reason: string | null }[], error: null }),
  ])
  if (confirmed.error) throw confirmed.error
  if (past.error) throw past.error
  if (blocks.error) throw blocks.error

  const confirmedRows = confirmed.data ?? []
  const todayRows = confirmedRows.filter((row) => new Date(row.starts_at) < tomorrowStart)
  const upcomingRows = confirmedRows.filter((row) => new Date(row.starts_at) >= tomorrowStart)
  const counts: Partial<Record<StatusTab, number>> = { hoje: todayRows.length, proximos: upcomingRows.length }
  const rows = statusTab === 'hoje' ? todayRows : statusTab === 'proximos' ? upcomingRows : (past.data ?? [])

  const empty = {
    hoje: 'Nada marcado para hoje.',
    proximos: `Nenhum agendamento por enquanto. Divulgue o link da vitrine e ${copy.yourPlace} começa a receber horários marcados.`,
    concluidos: 'Os atendimentos concluídos aparecem aqui.',
    cancelados: 'Os agendamentos cancelados aparecem aqui.',
  }[statusTab]

  const hours = Array.isArray(vitrine.business_hours) ? (vitrine.business_hours as BusinessHours) : DEFAULT_BUSINESS_HOURS
  const todayLabel = bookingDateLabel(today)

  return (
    <>
      <PanelTopBar title="Agenda" subtitle={`${copy.place} · ${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)}`} />
      <PanelBody>
        <div className="flex max-w-3xl flex-col gap-6">
          {/* Navegação principal: 2 abas */}
          <nav aria-label="Navegação da agenda" className="-mx-4 lg:mx-0">
            <ul className="flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] lg:px-0 [&::-webkit-scrollbar]:hidden">
              {MAIN_TABS.map(({ slug, label, Icon }) => {
                const active = mainTab === slug
                const href = slug === 'agendamentos' ? '/painel/agenda' : '/painel/agenda?secao=configurar'
                return (
                  <li key={slug} className="shrink-0">
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full border-2 px-4 text-base font-extrabold transition-colors duration-150 ease-out-quint ${
                        active
                          ? 'border-go-strong bg-surface text-go-strong shadow-xs'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {mainTab === 'agendamentos' ? (
            /* Aba 1: Agendamentos */
            <div className="flex flex-col gap-4">
              <nav aria-label="Situação dos agendamentos" className="-mx-4 lg:mx-0">
                <ul className="flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] lg:px-0 [&::-webkit-scrollbar]:hidden">
                  {STATUS_TABS.map(({ slug, label }) => {
                    const active = slug === statusTab
                    const count = counts[slug]
                    return (
                      <li key={slug} className="shrink-0">
                        <Link
                          href={slug === 'hoje' ? '/painel/agenda' : `/painel/agenda?aba=${slug}`}
                          aria-current={active ? 'page' : undefined}
                          className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-full border-2 px-3 text-sm font-extrabold transition-colors duration-150 ease-out-quint ${
                            active
                              ? 'border-go-strong bg-go-soft text-go-strong'
                              : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                          }`}
                        >
                          {label}
                          {count ? (
                            <span className="numeric rounded-full bg-go-strong px-2 py-0.5 text-xs text-white">{count}</span>
                          ) : null}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
              <Appointments
                key={statusTab}
                vitrineId={id}
                editable={statusTab === 'hoje' || statusTab === 'proximos'}
                emptyText={empty}
                appointments={rows.map(toAppointment)}
              />
            </div>
          ) : (
            /* Aba 2: Configurar agenda */
            <div className="flex flex-col gap-8">
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
            </div>
          )}
        </div>
      </PanelBody>
    </>
  )
}


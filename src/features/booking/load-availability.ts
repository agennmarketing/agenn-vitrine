import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import {
  bookingRange,
  DEFAULT_SERVICE_MINUTES,
  type AvailabilityInput,
  type BookingRules,
  type Interval,
} from '@/lib/booking/availability'
import { env } from '@/lib/env'
import { parseHost } from '@/lib/hosts/parse-host'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { BusinessHours } from '@/lib/vitrines/service-segments'

export const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status })

// As rotas da agenda só respondem no host da vitrine (mesmo host da página).
export function vitrineSubdomain(request: NextRequest): string | null {
  const host = parseHost(request.headers.get('host'), {
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    legacyDomains: env.LEGACY_DOMAINS,
  })
  return host.type === 'vitrine' ? host.subdomain : null
}

export type BookableProfessional = { id: string; name: string; availability: AvailabilityInput }

export type BookableService = {
  vitrine: { id: string; name: string; showPrices: boolean }
  item: { id: string; name: string; priceType: 'fixed' | 'from' | 'on_request'; priceCents: number | null; promoPriceCents: number | null }
  /** Agenda do negócio inteiro; é a que vale quando não há profissional cadastrado. */
  availability: AvailabilityInput
  /** Profissionais ativos que fazem este serviço, cada um com a própria agenda. */
  professionals: BookableProfessional[]
}

function readHours(value: unknown): BusinessHours {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is BusinessHours[number] =>
      typeof entry?.day === 'number' && typeof entry?.open === 'string' && typeof entry?.close === 'string',
  )
}

/*
 * Tudo que o motor de disponibilidade precisa para um serviço: regras da vitrine e o
 * que ocupa a agenda dentro da janela. Os agendamentos entram só como trechos
 * ocupados — nada de nome ou contato sai daqui.
 *
 * Com profissionais cadastrados, cada um tem a própria lista de ocupados: os
 * agendamentos dele mais os que não têm profissional (esses ocupam o negócio todo,
 * e é o caso de tudo que foi marcado antes de existirem profissionais).
 */
export async function loadBookableService(subdomain: string, itemId: string, now = new Date()): Promise<BookableService | null> {
  const admin = createSupabaseAdminClient()
  const { data: vitrine, error } = await admin
    .from('vitrines')
    .select('id, name, type, status, show_prices, business_hours, booking_buffer_minutes, booking_min_notice_minutes, booking_max_days_ahead')
    .eq('subdomain', subdomain)
    .maybeSingle()
  if (error) throw error
  if (!vitrine || vitrine.status !== 'active' || vitrine.type !== 'servicos') return null

  const { data: item, error: itemError } = await admin
    .from('items')
    .select('id, name, price_type, price_cents, promo_price_cents, duration_minutes, sold_out')
    .eq('id', itemId)
    .eq('vitrine_id', vitrine.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (itemError) throw itemError
  if (!item || item.sold_out) return null

  const rules: BookingRules = {
    hours: readHours(vitrine.business_hours),
    bufferMinutes: vitrine.booking_buffer_minutes,
    minNoticeMinutes: vitrine.booking_min_notice_minutes,
    maxDaysAhead: vitrine.booking_max_days_ahead,
  }
  const range = bookingRange(rules, now)
  const [appointments, blocks, links] = await Promise.all([
    admin
      .from('appointments')
      .select('starts_at, blocked_until, professional_id')
      .eq('vitrine_id', vitrine.id)
      .eq('status', 'confirmed')
      .lt('starts_at', range.end.toISOString())
      .gt('blocked_until', range.start.toISOString()),
    admin
      .from('booking_blocks')
      .select('starts_at, ends_at')
      .eq('vitrine_id', vitrine.id)
      .lt('starts_at', range.end.toISOString())
      .gt('ends_at', range.start.toISOString()),
    admin.from('professional_items').select('professional_id').eq('item_id', item.id),
  ])
  if (appointments.error) throw appointments.error
  if (blocks.error) throw blocks.error
  if (links.error) throw links.error

  const professionalIds = (links.data ?? []).map((link) => link.professional_id)
  const professionalRows = professionalIds.length
    ? await admin
        .from('professionals')
        .select('id, name, business_hours')
        .eq('vitrine_id', vitrine.id)
        .eq('active', true)
        .in('id', professionalIds)
        .order('position')
        .order('created_at')
    : { data: [], error: null }
  if (professionalRows.error) throw professionalRows.error

  const interval = (row: { starts_at: string; blocked_until: string }): Interval => ({
    start: new Date(row.starts_at),
    end: new Date(row.blocked_until),
  })
  const busyRows = appointments.data ?? []
  const blockList: Interval[] = (blocks.data ?? []).map((row) => ({ start: new Date(row.starts_at), end: new Date(row.ends_at) }))
  const durationMinutes = item.duration_minutes ?? DEFAULT_SERVICE_MINUTES
  const shared = { durationMinutes, rules, blocks: blockList, now }

  return {
    vitrine: { id: vitrine.id, name: vitrine.name, showPrices: vitrine.show_prices },
    item: {
      id: item.id,
      name: item.name,
      priceType: item.price_type as BookableService['item']['priceType'],
      priceCents: item.price_cents,
      promoPriceCents: item.promo_price_cents,
    },
    availability: { ...shared, busy: busyRows.map(interval) },
    professionals: (professionalRows.data ?? []).map((professional) => {
      // Sem horário próprio, o profissional atende nos horários da vitrine.
      const ownHours = readHours(professional.business_hours)
      return {
        id: professional.id,
        name: professional.name,
        availability: {
          ...shared,
          rules: { ...rules, hours: ownHours.length > 0 ? ownHours : rules.hours },
          busy: busyRows.filter((row) => row.professional_id === null || row.professional_id === professional.id).map(interval),
        },
      }
    }),
  }
}

/** Agendas que valem para este serviço: a de cada profissional ou, sem nenhum, a do negócio. */
export function bookableAgendas(service: BookableService): AvailabilityInput[] {
  return service.professionals.length > 0 ? service.professionals.map((p) => p.availability) : [service.availability]
}

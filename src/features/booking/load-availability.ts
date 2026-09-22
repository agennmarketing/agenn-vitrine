import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import {
  bookingRange,
  DEFAULT_SERVICE_MINUTES,
  type AvailabilityInput,
  type BookingRules,
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

export type BookableService = {
  vitrine: { id: string; name: string; showPrices: boolean }
  item: { id: string; name: string; priceType: 'fixed' | 'from' | 'on_request'; priceCents: number | null; promoPriceCents: number | null }
  availability: AvailabilityInput
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
  const [appointments, blocks] = await Promise.all([
    admin
      .from('appointments')
      .select('starts_at, blocked_until')
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
  ])
  if (appointments.error) throw appointments.error
  if (blocks.error) throw blocks.error

  return {
    vitrine: { id: vitrine.id, name: vitrine.name, showPrices: vitrine.show_prices },
    item: {
      id: item.id,
      name: item.name,
      priceType: item.price_type as BookableService['item']['priceType'],
      priceCents: item.price_cents,
      promoPriceCents: item.promo_price_cents,
    },
    availability: {
      durationMinutes: item.duration_minutes ?? DEFAULT_SERVICE_MINUTES,
      rules,
      busy: (appointments.data ?? []).map((row) => ({ start: new Date(row.starts_at), end: new Date(row.blocked_until) })),
      blocks: (blocks.data ?? []).map((row) => ({ start: new Date(row.starts_at), end: new Date(row.ends_at) })),
      now,
    },
  }
}

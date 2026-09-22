import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, loadBookableService, vitrineSubdomain } from '@/features/booking/load-availability'
import { saoPauloInstant, slotsForDate } from '@/lib/booking/availability'
import { parseBookingRequest } from '@/lib/booking/booking-request'
import { generateOrderCode } from '@/lib/codes/order-code'
import { clientIp, rateLimitKey } from '@/lib/orders/client-ip'
import { formatPriceLabel, priceLabel } from '@/lib/pricing/price'
import { getOrderRateLimit, getRateLimitSalt } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const SLOT_TAKEN_MESSAGE = 'Esse horário acabou de ser reservado. Escolha outro.'

// Agendamento feito pela vitrine: confere o horário com as mesmas regras que listaram
// os horários livres e grava pelo book_appointment, que impede a dupla reserva.
export async function POST(request: NextRequest) {
  const subdomain = vitrineSubdomain(request)
  if (!subdomain) return jsonError(404, 'Vitrine não encontrada.')

  const parsed = parseBookingRequest(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: 'Confira os dados do agendamento.', fieldErrors: parsed.errors }, { status: 422 })
  const booking = parsed.value

  try {
    const admin = createSupabaseAdminClient()
    const key = await rateLimitKey(clientIp(request.headers), 'agendamentos', getRateLimitSalt())
    const { data: allowed, error: limitError } = await admin.rpc('hit_rate_limit', {
      p_key: key,
      p_limit: getOrderRateLimit(),
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) return jsonError(429, 'Muitos agendamentos em pouco tempo. Tente mais tarde.')

    const service = await loadBookableService(subdomain, booking.itemId)
    if (!service) return jsonError(404, 'Serviço indisponível.')
    if (!slotsForDate(booking.date, service.availability).includes(booking.time)) return jsonError(409, SLOT_TAKEN_MESSAGE)

    const priceText = formatPriceLabel(priceLabel(service.item))
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateOrderCode()
      const { data: id, error } = await admin.rpc('book_appointment', {
        p_vitrine_id: service.vitrine.id,
        p_item_id: service.item.id,
        p_code: code,
        p_starts_at: saoPauloInstant(booking.date, booking.time).toISOString(),
        p_customer_name: booking.name,
        p_customer_phone: booking.phone,
        p_notes: booking.notes ?? '',
        p_price_text: priceText,
      })
      if (error?.message === 'slot_unavailable') return jsonError(409, SLOT_TAKEN_MESSAGE)
      if (error?.message === 'item_unavailable' || error?.message === 'vitrine_not_found') return jsonError(404, 'Serviço indisponível.')
      if (error) throw error
      if (id) {
        return NextResponse.json(
          {
            code,
            serviceName: service.item.name,
            date: booking.date,
            time: booking.time,
            priceText: service.vitrine.showPrices ? priceText : null,
          },
          { status: 201 },
        )
      }
    }
    return jsonError(503, 'Não foi possível agendar agora. Tente de novo.')
  } catch (error) {
    Sentry.captureException(error)
    return jsonError(503, 'Não foi possível agendar agora. Tente de novo.')
  }
}

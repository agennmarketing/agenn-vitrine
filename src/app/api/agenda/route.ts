import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, loadBookableService, vitrineSubdomain } from '@/features/booking/load-availability'
import { availableDates, slotsForDate } from '@/lib/booking/availability'
import { isIsoDate, isUuid } from '@/lib/booking/booking-request'

// A vitrine pergunta só "quais datas têm horário livre" e "quais horários estão livres
// nesta data". A agenda em si (quem marcou, o que está ocupado) nunca sai daqui.
export async function GET(request: NextRequest) {
  const subdomain = vitrineSubdomain(request)
  if (!subdomain) return jsonError(404, 'Vitrine não encontrada.')
  const itemId = request.nextUrl.searchParams.get('item')
  const date = request.nextUrl.searchParams.get('data')
  if (!isUuid(itemId) || (date !== null && !isIsoDate(date))) return jsonError(400, 'Consulta inválida.')

  try {
    const service = await loadBookableService(subdomain, itemId)
    if (!service) return jsonError(404, 'Serviço indisponível.')
    const body = date === null ? { dates: availableDates(service.availability) } : { times: slotsForDate(date, service.availability) }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    Sentry.captureException(error)
    return jsonError(503, 'Não foi possível carregar a agenda agora.')
  }
}

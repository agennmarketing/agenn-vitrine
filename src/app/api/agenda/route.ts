import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { bookableAgendas, jsonError, loadBookableService, vitrineSubdomain } from '@/features/booking/load-availability'
import { availableDates, slotsForDate } from '@/lib/booking/availability'
import { isIsoDate, isTime, isUuid } from '@/lib/booking/booking-request'

// A vitrine pergunta só "quais datas têm horário livre", "quais horários estão livres
// nesta data" e "quem atende neste horário". A agenda em si (quem marcou, o que está
// ocupado) nunca sai daqui.
export async function GET(request: NextRequest) {
  const subdomain = vitrineSubdomain(request)
  if (!subdomain) return jsonError(404, 'Vitrine não encontrada.')
  const params = request.nextUrl.searchParams
  const itemId = params.get('item')
  const date = params.get('data')
  const time = params.get('hora')
  const professionalId = params.get('profissional')
  if (!isUuid(itemId)) return jsonError(400, 'Consulta inválida.')
  if (date !== null && !isIsoDate(date)) return jsonError(400, 'Consulta inválida.')
  if (time !== null && !isTime(time)) return jsonError(400, 'Consulta inválida.')
  if (professionalId !== null && !isUuid(professionalId)) return jsonError(400, 'Consulta inválida.')

  try {
    const service = await loadBookableService(subdomain, itemId)
    if (!service) return jsonError(404, 'Serviço indisponível.')

    // Quem atende neste dia e horário (o cliente escolhe depois de ver o horário livre).
    if (date !== null && time !== null) {
      const professionals = service.professionals
        .filter((professional) => slotsForDate(date, professional.availability).includes(time))
        .map((professional) => ({ id: professional.id, name: professional.name }))
      return NextResponse.json({ professionals }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const chosen = professionalId ? service.professionals.find((professional) => professional.id === professionalId) : null
    if (professionalId && !chosen) return jsonError(404, 'Profissional indisponível.')
    const agendas = chosen ? [chosen.availability] : bookableAgendas(service)

    // Sem profissional escolhido, vale a união: a data (ou o horário) aparece se pelo
    // menos um profissional puder atender.
    const body =
      date === null
        ? { dates: union(agendas.map((agenda) => availableDates(agenda))) }
        : { times: union(agendas.map((agenda) => slotsForDate(date, agenda))) }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    Sentry.captureException(error)
    return jsonError(503, 'Não foi possível carregar a agenda agora.')
  }
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort()
}

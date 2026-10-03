import { saoPauloDate, weekday } from '@/lib/booking/availability'
import { WEEKDAYS, type BusinessHours } from './service-segments'

// Ordem em que a semana aparece para o cliente: de segunda a domingo.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Lê a coluna jsonb `business_hours`, descartando o que não for um dia válido. */
export function readBusinessHours(value: unknown): BusinessHours {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is BusinessHours[number] =>
      typeof entry?.day === 'number' && typeof entry?.open === 'string' && typeof entry?.close === 'string',
  )
}

function formatHour(time: string): string {
  const [hours, minutes] = time.split(':')
  return `${Number(hours)}h${minutes === '00' ? '' : minutes}`
}

/** "09:00" e "18:00" viram "9h–18h". */
export function formatTimeRange(open: string, close: string): string {
  return `${formatHour(open)}–${formatHour(close)}`
}

export function weekSchedule(hours: BusinessHours) {
  return WEEK_ORDER.map((day) => {
    const entry = hours.find((h) => h.day === day)
    return { day, label: WEEKDAYS[day], range: entry ? formatTimeRange(entry.open, entry.close) : null }
  })
}

/** Resumo de hoje no fuso de São Paulo: "Hoje: 9h–18h" ou "Fechado hoje". */
export function todayHoursLabel(hours: BusinessHours, now: Date): string {
  const today = weekday(saoPauloDate(now))
  const entry = hours.find((h) => h.day === today)
  return entry ? `Hoje: ${formatTimeRange(entry.open, entry.close)}` : 'Fechado hoje'
}

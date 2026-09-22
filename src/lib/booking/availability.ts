import type { BusinessHours } from '@/lib/vitrines/service-segments'

/*
 * Disponibilidade da agenda (um atendimento por vez). Tudo em horário de São Paulo,
 * UTC−3 fixo (o Brasil não tem horário de verão desde 2019).
 *
 * Um início é livre quando cai na grade de 30 min a partir da abertura, o serviço
 * termina até o fechamento, respeita antecedência e janela, [início, fim + intervalo)
 * não cruza nenhum agendamento (que já inclui o próprio intervalo) e [início, fim)
 * não cruza bloqueio avulso. O book_appointment do banco confere as duas últimas de novo.
 */

export const SLOT_STEP_MINUTES = 30
// Serviços antigos sem duração valem 60 min (mesmo valor do banco).
export const DEFAULT_SERVICE_MINUTES = 60

const OFFSET = '-03:00'
const MINUTE = 60_000

export type BookingRules = {
  hours: BusinessHours
  bufferMinutes: number
  minNoticeMinutes: number
  maxDaysAhead: number
}

export type Interval = { start: Date; end: Date }

export type AvailabilityInput = {
  durationMinutes: number
  rules: BookingRules
  /** Agendamentos confirmados: [início, blocked_until). */
  busy: Interval[]
  blocks: Interval[]
  now: Date
}

export function saoPauloInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${OFFSET}`)
}

// O instante deslocado para UTC−3 e lido em UTC dá a data e a hora de São Paulo.
function shifted(instant: Date): string {
  return new Date(instant.getTime() - 3 * 60 * MINUTE).toISOString()
}

export function saoPauloDate(instant: Date): string {
  return shifted(instant).slice(0, 10)
}

export function saoPauloTime(instant: Date): string {
  return shifted(instant).slice(11, 16)
}

export function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T12:00:00Z`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function overlaps(start: Date, end: Date, intervals: Interval[]): boolean {
  return intervals.some((interval) => interval.start < end && interval.end > start)
}

export function lastBookableDate(rules: BookingRules, now: Date): string {
  return addDays(saoPauloDate(now), rules.maxDaysAhead)
}

/** Trecho a consultar no banco: de agora até o fim do último dia da janela. */
export function bookingRange(rules: BookingRules, now: Date): Interval {
  return { start: now, end: saoPauloInstant(addDays(lastBookableDate(rules, now), 1), '00:00') }
}

export function slotsForDate(date: string, input: AvailabilityInput): string[] {
  const { rules, now, durationMinutes } = input
  const today = saoPauloDate(now)
  if (date < today || date > lastBookableDate(rules, now)) return []
  const entry = rules.hours.find((hours) => hours.day === weekday(date))
  if (!entry) return []

  const earliest = new Date(now.getTime() + rules.minNoticeMinutes * MINUTE)
  const close = toMinutes(entry.close)
  const slots: string[] = []
  for (let minutes = toMinutes(entry.open); minutes + durationMinutes <= close; minutes += SLOT_STEP_MINUTES) {
    const time = toTime(minutes)
    const start = saoPauloInstant(date, time)
    if (start < earliest) continue
    const end = new Date(start.getTime() + durationMinutes * MINUTE)
    const blockedUntil = new Date(end.getTime() + rules.bufferMinutes * MINUTE)
    if (overlaps(start, blockedUntil, input.busy) || overlaps(start, end, input.blocks)) continue
    slots.push(time)
  }
  return slots
}

export function availableDates(input: AvailabilityInput): string[] {
  const dates: string[] = []
  const today = saoPauloDate(input.now)
  for (let offset = 0; offset <= input.rules.maxDaysAhead; offset++) {
    const date = addDays(today, offset)
    if (slotsForDate(date, input).length > 0) dates.push(date)
  }
  return dates
}

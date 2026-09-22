import { weekday } from './availability'

const WEEKDAY_SHORT = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'] as const
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

export function dayMonth(date: string): string {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

/** "segunda, 07/01" */
export function bookingDateLabel(date: string): string {
  return `${WEEKDAY_LONG[weekday(date)]}, ${dayMonth(date)}`
}

/** Partes do botão de data: "seg." e "07/01". */
export function bookingDateChip(date: string): { weekday: string; day: string } {
  return { weekday: WEEKDAY_SHORT[weekday(date)], day: dayMonth(date) }
}

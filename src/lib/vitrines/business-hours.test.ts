import { describe, expect, it } from 'vitest'
import { formatTimeRange, readBusinessHours, todayHoursLabel, weekSchedule } from './business-hours'

const hours = [
  { day: 1, open: '09:00', close: '18:00' },
  { day: 6, open: '08:30', close: '12:00' },
]

describe('formatTimeRange', () => {
  it('escreve as horas sem zero à esquerda e os minutos só quando há', () => {
    expect(formatTimeRange('09:00', '18:00')).toBe('9h–18h')
    expect(formatTimeRange('08:30', '12:15')).toBe('8h30–12h15')
  })
})

describe('weekSchedule', () => {
  it('lista a semana de segunda a domingo, com os dias sem horário fechados', () => {
    expect(weekSchedule(hours)).toEqual([
      { day: 1, label: 'Segunda', range: '9h–18h' },
      { day: 2, label: 'Terça', range: null },
      { day: 3, label: 'Quarta', range: null },
      { day: 4, label: 'Quinta', range: null },
      { day: 5, label: 'Sexta', range: null },
      { day: 6, label: 'Sábado', range: '8h30–12h' },
      { day: 0, label: 'Domingo', range: null },
    ])
  })
})

describe('todayHoursLabel', () => {
  it('usa o dia de São Paulo', () => {
    // 2026-10-05 é segunda; 02:00 UTC ainda é domingo em São Paulo.
    expect(todayHoursLabel(hours, new Date('2026-10-05T15:00:00Z'))).toBe('Hoje: 9h–18h')
    expect(todayHoursLabel(hours, new Date('2026-10-05T02:00:00Z'))).toBe('Fechado hoje')
  })
})

describe('readBusinessHours', () => {
  it('descarta o que não é uma lista de dias', () => {
    expect(readBusinessHours(null)).toEqual([])
    expect(readBusinessHours({})).toEqual([])
    expect(readBusinessHours([{ day: 1, open: '09:00', close: '18:00' }, { day: 'x' }])).toEqual([
      { day: 1, open: '09:00', close: '18:00' },
    ])
  })
})

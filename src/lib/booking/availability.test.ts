import { describe, expect, it } from 'vitest'
import {
  addDays,
  availableDates,
  bookingRange,
  saoPauloDate,
  saoPauloInstant,
  saoPauloTime,
  slotsForDate,
  weekday,
  type AvailabilityInput,
} from './availability'

// 2030-01-07 é uma segunda-feira.
const MONDAY = '2030-01-07'
const at = (date: string, time: string) => saoPauloInstant(date, time)

function input(overrides: Partial<AvailabilityInput> = {}, rules: Partial<AvailabilityInput['rules']> = {}): AvailabilityInput {
  return {
    durationMinutes: 60,
    rules: {
      hours: [{ day: 1, open: '09:00', close: '12:00' }],
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      maxDaysAhead: 30,
      ...rules,
    },
    busy: [],
    blocks: [],
    now: at('2030-01-06', '20:00'),
    ...overrides,
  }
}

describe('fuso de São Paulo', () => {
  it('converte data e hora locais para o instante UTC−3', () => {
    expect(at(MONDAY, '09:00').toISOString()).toBe('2030-01-07T12:00:00.000Z')
    expect(saoPauloDate(new Date('2030-01-08T02:30:00Z'))).toBe(MONDAY)
    expect(saoPauloTime(new Date('2030-01-08T02:30:00Z'))).toBe('23:30')
  })

  it('soma dias e acha o dia da semana', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01')
    expect(weekday(MONDAY)).toBe(1)
    expect(weekday('2030-01-06')).toBe(0)
  })
})

describe('horários de uma data', () => {
  it('grade de 30 min em que o serviço termina até o fechamento', () => {
    expect(slotsForDate(MONDAY, input())).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })

  it('dia sem atendimento não tem horários', () => {
    expect(slotsForDate('2030-01-08', input())).toEqual([])
  })

  it('agendamento ocupa o trecho até o fim do intervalo', () => {
    // Ocupado de 10:00 até 11:15 (60 min + 15 de intervalo).
    const busy = [{ start: at(MONDAY, '10:00'), end: at(MONDAY, '11:15') }]
    expect(slotsForDate(MONDAY, input({ busy }, { bufferMinutes: 15 }))).toEqual([])
    expect(slotsForDate(MONDAY, input({ busy, durationMinutes: 30 }, { bufferMinutes: 0 }))).toEqual([
      '09:00',
      '09:30',
      '11:30',
    ])
  })

  it('o intervalo do novo agendamento também precisa caber antes do próximo', () => {
    const busy = [{ start: at(MONDAY, '10:30'), end: at(MONDAY, '11:00') }]
    expect(slotsForDate(MONDAY, input({ busy, durationMinutes: 30 }, { bufferMinutes: 15 }))).toEqual(['09:00', '09:30', '11:00', '11:30'])
  })

  it('bloqueio avulso tira os horários que cruzam com ele', () => {
    const blocks = [{ start: at(MONDAY, '09:30'), end: at(MONDAY, '10:30') }]
    expect(slotsForDate(MONDAY, input({ blocks }))).toEqual(['10:30', '11:00'])
  })

  it('respeita a antecedência mínima', () => {
    expect(slotsForDate(MONDAY, input({ now: at(MONDAY, '08:10') }, { minNoticeMinutes: 120 }))).toEqual(['10:30', '11:00'])
  })

  it('não oferece data fora da janela nem no passado', () => {
    expect(slotsForDate(MONDAY, input({ now: at('2030-01-01', '08:00') }, { maxDaysAhead: 5 }))).toEqual([])
    expect(slotsForDate(MONDAY, input({ now: at('2030-01-08', '08:00') }))).toEqual([])
  })

  it('serviço maior que o expediente não cabe', () => {
    expect(slotsForDate(MONDAY, input({ durationMinutes: 240 }))).toEqual([])
  })
})

describe('datas com disponibilidade', () => {
  it('lista só as datas com pelo menos um horário livre', () => {
    const busy = [{ start: at(MONDAY, '09:00'), end: at(MONDAY, '12:00') }]
    const dates = availableDates(input({ busy, now: at('2029-12-31', '08:00') }, { maxDaysAhead: 14 }))
    expect(dates).toEqual(['2029-12-31', '2030-01-14'])
  })

  it('o intervalo de consulta vai de agora até o fim do último dia da janela', () => {
    const range = bookingRange(input().rules, at(MONDAY, '10:00'))
    expect(range.start.toISOString()).toBe(at(MONDAY, '10:00').toISOString())
    expect(range.end.toISOString()).toBe(at('2030-02-07', '00:00').toISOString())
  })
})

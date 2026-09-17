import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('assume Brasil quando não há código do país', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('+5511987654321')
    expect(normalizePhone('11987654321')).toBe('+5511987654321')
    expect(normalizePhone('+55 11 98765-4321')).toBe('+5511987654321')
  })

  it('aceita outros países com +', () => {
    expect(normalizePhone('+351 912 345 678')).toBe('+351912345678')
  })

  it('recusa números inválidos', () => {
    for (const bad of ['', '1234', '(11) 1234', 'abc']) expect(normalizePhone(bad)).toBeNull()
  })
})

it('formatPhone mostra o número legível', () => {
  expect(formatPhone('+5511987654321')).toBe('+55 11 98765 4321')
})

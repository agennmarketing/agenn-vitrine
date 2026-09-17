import { describe, expect, it } from 'vitest'
import { formatDateBR } from './format'

describe('formatDateBR', () => {
  it('mostra a data no fuso de São Paulo', () => {
    expect(formatDateBR('2026-12-01T12:00:00.000Z')).toBe('01/12/2026')
    expect(formatDateBR(new Date('2026-03-10T23:30:00.000Z'))).toBe('10/03/2026')
  })

  it('usa o dia em São Paulo, não em UTC', () => {
    expect(formatDateBR('2026-01-01T02:00:00.000Z')).toBe('31/12/2025')
  })

  it('devolve vazio sem data', () => {
    expect(formatDateBR(null)).toBe('')
  })
})

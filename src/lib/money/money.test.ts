import { describe, expect, it } from 'vitest'
import { centsToInput, formatBRL, parseBRLToCents } from './money'

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(1290)).toBe('R$ 12,90')
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
    expect(formatBRL(0)).toBe('R$ 0,00')
  })
})

describe('parseBRLToCents', () => {
  it('aceita os formatos comuns', () => {
    expect(parseBRLToCents('12,90')).toBe(1290)
    expect(parseBRLToCents('12')).toBe(1200)
    expect(parseBRLToCents('12,9')).toBe(1290)
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('R$ 7,05')).toBe(705)
    expect(parseBRLToCents(' 0,99 ')).toBe(99)
  })

  it('recusa o que não é valor', () => {
    for (const bad of ['', 'abc', '-1', '12.9', '12,999', '1,2,3', '999999999']) {
      expect(parseBRLToCents(bad)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('volta para o formato do campo', () => {
    expect(centsToInput(1290)).toBe('12,90')
    expect(centsToInput(123456)).toBe('1234,56')
    expect(centsToInput(null)).toBe('')
  })
})

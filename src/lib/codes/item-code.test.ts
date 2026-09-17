import { describe, expect, it } from 'vitest'
import { normalizeItemCode, validateItemCode } from './item-code'

describe('código do item', () => {
  it('normaliza: maiúsculas, sem espaços e sem acentos', () => {
    expect(normalizeItemCode(' ab 1 ')).toBe('AB1')
    expect(normalizeItemCode('pão')).toBe('PAO')
    expect(normalizeItemCode('Açaí2')).toBe('ACAI2')
  })

  it('valida de 1 a 6 letras ou números', () => {
    expect(validateItemCode('x1')).toEqual({ ok: true, value: 'X1' })
    expect(validateItemCode('104')).toEqual({ ok: true, value: '104' })
    expect(validateItemCode('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(validateItemCode('ABCDEFG')).toEqual({ ok: false, reason: 'format' })
    expect(validateItemCode('A-1')).toEqual({ ok: false, reason: 'format' })
  })
})

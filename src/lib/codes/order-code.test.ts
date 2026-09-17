import { describe, expect, it } from 'vitest'
import { generateOrderCode, isValidOrderCode, normalizeOrderCode, ORDER_CODE_ALPHABET } from './order-code'

describe('código do pedido', () => {
  it('alfabeto sem caracteres ambíguos', () => {
    expect(ORDER_CODE_ALPHABET).toHaveLength(32)
    for (const ambiguous of ['0', '1', 'I', 'O']) expect(ORDER_CODE_ALPHABET).not.toContain(ambiguous)
  })

  it('gera 4 caracteres do alfabeto a partir dos bytes', () => {
    expect(generateOrderCode(() => new Uint8Array([0, 31, 32, 255]))).toBe('2Z2Z')
    for (let i = 0; i < 200; i++) expect(isValidOrderCode(generateOrderCode())).toBe(true)
  })

  it('normaliza o que o dono digita', () => {
    expect(normalizeOrderCode(' #k7f2 ')).toBe('K7F2')
    expect(isValidOrderCode('K7F2')).toBe(true)
    expect(isValidOrderCode('K0F2')).toBe(false)
    expect(isValidOrderCode('K7F')).toBe(false)
  })
})

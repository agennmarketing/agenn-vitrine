import { describe, expect, it } from 'vitest'
import { parseBRLToCents } from '@/lib/money/money'
import { maskEmail, maskMoney, maskPhone } from './masks'

describe('maskMoney', () => {
  it('põe o ponto de milhar e mantém a vírgula', () => {
    expect(maskMoney('')).toBe('')
    expect(maskMoney('5')).toBe('5')
    expect(maskMoney('1234')).toBe('1.234')
    expect(maskMoney('1234,5')).toBe('1.234,5')
    expect(maskMoney('1234567,89')).toBe('123.456,89')
    expect(maskMoney('49,')).toBe('49,')
    expect(maskMoney(',5')).toBe('0,5')
  })

  it('limpa letras, zeros à esquerda e casas a mais', () => {
    expect(maskMoney('R$ 0049,999')).toBe('49,99')
    expect(maskMoney('abc')).toBe('')
    expect(maskMoney('1,2,3')).toBe('1,23')
  })

  it('ponto digitado no fim vira vírgula; os outros são do milhar', () => {
    expect(maskMoney('49.')).toBe('49,')
    expect(maskMoney('1.23')).toBe('123')
    expect(maskMoney('1.234')).toBe('1.234')
    expect(maskMoney('1.234,56')).toBe('1.234,56')
    expect(maskMoney('1.2345')).toBe('12.345')
  })

  it('aplicar de novo não muda nada e o servidor entende o resultado', () => {
    for (const raw of ['49,90', '1234,5', '12', '999999,99', '49,']) {
      const masked = maskMoney(raw)
      expect(maskMoney(masked)).toBe(masked)
      expect(parseBRLToCents(masked)).not.toBeNull()
    }
  })
})

describe('maskPhone', () => {
  it('formata celular e fixo enquanto digita', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('1')).toBe('(1')
    expect(maskPhone('19')).toBe('(19')
    expect(maskPhone('199')).toBe('(19) 9')
    expect(maskPhone('1932088')).toBe('(19) 3208-8')
    expect(maskPhone('1932088644')).toBe('(19) 3208-8644')
    expect(maskPhone('19992088644')).toBe('(19) 99208-8644')
    expect(maskPhone('199920886449')).toBe('(19) 99208-8644')
  })

  it('o +55 vira o formato nacional; outro país fica como está', () => {
    expect(maskPhone('+55 19 99208 8644')).toBe('(19) 99208-8644')
    expect(maskPhone('+1 (415) 555-0100')).toBe('+1 (415) 555-0100')
  })

  it('aplicar de novo não muda nada', () => {
    expect(maskPhone('(19) 99208-8644')).toBe('(19) 99208-8644')
  })
})

describe('maskEmail', () => {
  it('tira espaços e maiúsculas', () => {
    expect(maskEmail(' Maria.Silva @Gmail.com ')).toBe('maria.silva@gmail.com')
  })
})

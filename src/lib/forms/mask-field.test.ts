import { describe, expect, it } from 'vitest'
import { maskField } from './mask-field'

// Campo de mentira: só o que a máscara usa.
function field(value: string, caret = value.length, defaultValue = '') {
  const input = {
    value,
    defaultValue,
    selectionStart: caret as number | null,
    setSelectionRange(start: number) {
      input.selectionStart = start
    },
  }
  return input as typeof input & HTMLInputElement
}

describe('maskField', () => {
  it('formata e deixa o cursor no fim quando se digita no fim', () => {
    const input = field('199920')
    expect(maskField(input, 'phone')).toBe('(19) 9920')
    expect(input.selectionStart).toBe('(19) 9920'.length)
  })

  it('editando no meio, o cursor fica depois do mesmo dígito', () => {
    // "(19) 9920-8" com um 1 digitado logo depois do DDD.
    const input = field('(19) 19920-8', 6)
    expect(maskField(input, 'phone')).toBe('(19) 1992-08')
    expect(input.selectionStart).toBe(6)
    const money = field('1.2345,00', 6)
    expect(maskField(money, 'money')).toBe('12.345,00')
    expect(money.selectionStart).toBe(6)
  })

  it('apagar só a pontuação apaga o dígito de antes', () => {
    // "(19) 9920-8" → apagou o "-" (cursor estava depois dele).
    const input = field('(19) 99208', 9, '(19) 9920-8')
    expect(maskField(input, 'phone', 'deleteContentBackward')).toBe('(19) 9928')
    expect(input.selectionStart).toBe(8)
  })

  it('ponto digitado no fim vira vírgula e o cursor segue no fim', () => {
    const input = field('49.')
    expect(maskField(input, 'money')).toBe('49,')
    expect(input.selectionStart).toBe(3)
  })
})

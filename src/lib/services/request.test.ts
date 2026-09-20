import { describe, expect, it } from 'vitest'
import { EMPTY_SERVICE_REQUEST, validateServiceRequest } from './request'

const today = '2026-09-20'
const filled = { name: 'Maria Silva', date: '2026-09-25', time: '14:30', notes: 'Cabelo bem curto' }

describe('etapa "Quero esse serviço"', () => {
  it('só o nome é obrigatório', () => {
    expect(validateServiceRequest({ ...EMPTY_SERVICE_REQUEST, name: '  Maria  ' }, today)).toEqual({
      ok: true,
      value: { name: 'Maria', date: null, time: null, notes: null },
    })
  })

  it('devolve tudo o que o cliente preencheu', () => {
    expect(validateServiceRequest(filled, today)).toEqual({ ok: true, value: filled })
  })

  it('sem nome não segue', () => {
    const result = validateServiceRequest(EMPTY_SERVICE_REQUEST, today)
    expect(result).toEqual({ ok: false, errors: { name: 'Informe seu nome.' } })
  })

  it('data no passado não vale', () => {
    const result = validateServiceRequest({ ...filled, date: '2026-09-19' }, today)
    expect(result).toEqual({ ok: false, errors: { date: 'Escolha uma data a partir de hoje.' } })
  })

  it('a data de hoje vale', () => {
    expect(validateServiceRequest({ ...filled, date: today }, today).ok).toBe(true)
  })

  it('limites de tamanho', () => {
    const result = validateServiceRequest({ ...EMPTY_SERVICE_REQUEST, name: 'a'.repeat(61), notes: 'b'.repeat(301) }, today)
    expect(result).toEqual({
      ok: false,
      errors: { name: 'Use até 60 caracteres.', notes: 'Use até 300 caracteres.' },
    })
  })
})

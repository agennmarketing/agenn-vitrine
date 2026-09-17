import { describe, expect, it } from 'vitest'
import { EMPTY_CHECKOUT_INPUT, todayInSaoPaulo, validateCheckout, type CheckoutSettings } from './checkout'

const comida: CheckoutSettings = {
  nameMode: 'required', fulfillmentMode: 'required', paymentMode: 'required', scheduleMode: 'optional', notesMode: 'optional',
  paymentOptions: ['Pix', 'Cartão na entrega', 'Dinheiro'],
}
const today = '2026-09-17'

describe('validateCheckout', () => {
  it('obrigatórios vazios', () => {
    expect(validateCheckout(comida, EMPTY_CHECKOUT_INPUT, today)).toEqual({
      ok: false,
      errors: {
        name: 'Informe seu nome.',
        fulfillment: 'Escolha retirada ou entrega.',
        payment: 'Escolha a forma de pagamento.',
      },
    })
  })

  it('entrega exige endereço; dinheiro aceita troco', () => {
    const input = { ...EMPTY_CHECKOUT_INPUT, name: ' Ana ', fulfillment: 'entrega', payment: 'Dinheiro', changeFor: '50' }
    expect(validateCheckout(comida, input, today)).toEqual({
      ok: false,
      errors: { address: 'Informe o endereço de entrega.' },
    })
    expect(validateCheckout(comida, { ...input, address: 'Rua A, 10' }, today)).toEqual({
      ok: true,
      value: {
        name: 'Ana',
        fulfillment: 'entrega',
        address: 'Rua A, 10',
        payment: 'Dinheiro',
        changeForCents: 5000,
        schedule: null,
        notes: null,
      },
    })
  })

  it('pagamento fora da lista, troco inválido, data no passado e horário faltando', () => {
    const base = { ...EMPTY_CHECKOUT_INPUT, name: 'Ana', fulfillment: 'retirada' }
    expect(validateCheckout(comida, { ...base, payment: 'Boleto' }, today)).toEqual({
      ok: false,
      errors: { payment: 'Escolha uma forma de pagamento da lista.' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Dinheiro', changeFor: 'abc' }, today)).toEqual({
      ok: false,
      errors: { changeFor: 'Valor inválido. Ex.: 50,00' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Pix', date: '2026-09-16', time: '19:30' }, today)).toEqual({
      ok: false,
      errors: { date: 'Escolha uma data a partir de hoje.' },
    })
    expect(validateCheckout(comida, { ...base, payment: 'Pix', date: '2026-09-20' }, today)).toEqual({
      ok: false,
      errors: { time: 'Informe o horário.' },
    })
  })

  it('campos desligados são ignorados e observação tem limite', () => {
    const off: CheckoutSettings = { ...comida, nameMode: 'off', fulfillmentMode: 'off', paymentMode: 'off', scheduleMode: 'off' }
    expect(validateCheckout(off, { ...EMPTY_CHECKOUT_INPUT, name: 'Ana', payment: 'Pix', notes: ' sem pressa ' }, today)).toEqual({
      ok: true,
      value: { name: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: 'sem pressa' },
    })
    expect(validateCheckout(off, { ...EMPTY_CHECKOUT_INPUT, notes: 'x'.repeat(301) }, today)).toEqual({
      ok: false,
      errors: { notes: 'Use até 300 caracteres.' },
    })
  })
})

it('hoje em São Paulo', () => {
  expect(todayInSaoPaulo(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17')
})

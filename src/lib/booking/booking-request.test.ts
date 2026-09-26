import { describe, expect, it } from 'vitest'
import { parseBookingRequest, validateBookingContact } from './booking-request'

const ITEM = '00000000-0000-4000-8000-000000000001'

describe('dados do cliente no agendamento', () => {
  it('exige nome e WhatsApp válido', () => {
    expect(validateBookingContact({ name: ' ', whatsapp: '', notes: '' })).toEqual({
      ok: false,
      errors: { name: 'Informe seu nome.', whatsapp: 'Informe seu WhatsApp.' },
    })
    expect(validateBookingContact({ name: 'Maria', whatsapp: '123', notes: '' })).toEqual({
      ok: false,
      errors: { whatsapp: 'Informe um WhatsApp válido com DDD.' },
    })
  })

  it('normaliza o WhatsApp e deixa a observação opcional', () => {
    expect(validateBookingContact({ name: ' Maria ', whatsapp: '(11) 91234-5678', notes: '  ' })).toEqual({
      ok: true,
      value: { name: 'Maria', phone: '+5511912345678', notes: null },
    })
  })

  it('limita a observação a 300 caracteres', () => {
    const result = validateBookingContact({ name: 'Maria', whatsapp: '11912345678', notes: 'a'.repeat(301) })
    expect(result).toEqual({ ok: false, errors: { notes: 'Use até 300 caracteres.' } })
  })
})

describe('corpo do agendamento', () => {
  const body = { itemId: ITEM, date: '2030-01-07', time: '09:30', name: 'Maria', whatsapp: '11912345678', notes: 'unha curta' }

  it('aceita um pedido completo', () => {
    expect(parseBookingRequest(body)).toEqual({
      ok: true,
      value: {
        itemId: ITEM,
        date: '2030-01-07',
        time: '09:30',
        professionalId: null,
        name: 'Maria',
        phone: '+5511912345678',
        notes: 'unha curta',
      },
    })
    // Com profissional escolhido, o id vai junto.
    const comProfissional = parseBookingRequest({ ...body, professionalId: ITEM })
    expect(comProfissional.ok && comProfissional.value.professionalId).toBe(ITEM)
  })

  it('recusa serviço, data ou horário malformados', () => {
    expect(parseBookingRequest({ ...body, itemId: 'x' }).ok).toBe(false)
    expect(parseBookingRequest({ ...body, date: '07/01/2030' }).ok).toBe(false)
    expect(parseBookingRequest({ ...body, time: '9:30' }).ok).toBe(false)
    expect(parseBookingRequest(null).ok).toBe(false)
  })
})

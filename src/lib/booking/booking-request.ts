import { normalizePhone } from '@/lib/whatsapp/phone'

/*
 * Dados do cliente no agendamento (nome, WhatsApp e observação opcional). A mesma
 * validação roda no popup da vitrine e na API — sem zod, para não pesar no cliente.
 */
export type BookingContactInput = { name: string; whatsapp: string; notes: string }

export type BookingContactValue = { name: string; phone: string; notes: string | null }

export type BookingContactErrors = Partial<Record<keyof BookingContactInput, string>>

export const EMPTY_BOOKING_CONTACT: BookingContactInput = { name: '', whatsapp: '', notes: '' }

export function validateBookingContact(
  input: BookingContactInput,
): { ok: true; value: BookingContactValue } | { ok: false; errors: BookingContactErrors } {
  const errors: BookingContactErrors = {}

  const name = input.name.trim()
  if (!name) errors.name = 'Informe seu nome.'
  else if (name.length > 60) errors.name = 'Use até 60 caracteres.'

  const phone = normalizePhone(input.whatsapp)
  if (!input.whatsapp.trim()) errors.whatsapp = 'Informe seu WhatsApp.'
  else if (!phone) errors.whatsapp = 'Informe um WhatsApp válido com DDD.'

  const notes = input.notes.trim()
  if (notes.length > 300) errors.notes = 'Use até 300 caracteres.'

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors }
  return { ok: true, value: { name, phone, notes: notes || null } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())
}

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value)
}

export type BookingRequest = { itemId: string; date: string; time: string; professionalId: string | null } & BookingContactValue

// Corpo do POST /api/agendamentos.
export function parseBookingRequest(
  body: unknown,
): { ok: true; value: BookingRequest } | { ok: false; errors: BookingContactErrors } {
  const raw = (body ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
  if (!isUuid(raw.itemId) || !isIsoDate(raw.date) || !TIME.test(text('time'))) return { ok: false, errors: {} }
  const contact = validateBookingContact({ name: text('name'), whatsapp: text('whatsapp'), notes: text('notes') })
  if (!contact.ok) return contact
  const professionalId = isUuid(raw.professionalId) ? raw.professionalId : null
  return { ok: true, value: { itemId: raw.itemId, date: raw.date, time: text('time'), professionalId, ...contact.value } }
}

import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const phone = parsePhoneNumberFromString(trimmed, 'BR')
  return phone?.isValid() ? phone.number : null
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164
}

/*
 * Máscaras dos campos digitados: valor em reais, telefone e e-mail. Funções puras;
 * `mask-field.ts` aplica no campo e cuida do cursor.
 */

// Inteiros até 999.999 (o banco aceita até R$ 999.999,99).
const MAX_INT_DIGITS = 6

const onlyDigits = (value: string) => value.replace(/\D/g, '')

/*
 * "1234,5" → "1.234,5". A vírgula é a casa decimal (até 2 dígitos). Os pontos são do
 * milhar e a máscara refaz; só um ponto recém-digitado no fim vira vírgula ("49." → "49,").
 */
export function maskMoney(raw: string): string {
  const s = raw.replace(/[^\d.,]/g, '')
  let int = s
  let dec: string | null = null
  const comma = s.indexOf(',')
  if (comma >= 0) {
    int = s.slice(0, comma)
    dec = s.slice(comma + 1)
  } else if (s.endsWith('.')) {
    int = s.slice(0, -1)
    dec = ''
  }
  int = onlyDigits(int).replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS)
  if (dec === null) return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${(int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${onlyDigits(dec).slice(0, 2)}`
}

/*
 * Celular e fixo do Brasil: "(11) 98765-4321" / "(11) 3456-7890". Um número com "+"
 * de outro país fica como a pessoa digitou (só sem letras); o +55 vira o formato daqui.
 */
export function maskPhone(raw: string): string {
  const trimmed = raw.trimStart()
  let digits = onlyDigits(trimmed)
  if (trimmed.startsWith('+')) {
    if (!digits.startsWith('55')) return `+${raw.replace(/[^\d\s()-]/g, '').trimStart()}`
    digits = digits.slice(2)
  }
  digits = digits.slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const split = digits.length === 11 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

// E-mail não tem espaço nem maiúscula.
export function maskEmail(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase()
}

export type MaskKind = 'money' | 'phone' | 'email'

export const MASKS: Record<MaskKind, (raw: string) => string> = { money: maskMoney, phone: maskPhone, email: maskEmail }

// O que conta para manter o cursor no lugar: o que a pessoa digitou, não a pontuação da máscara.
export const SIGNIFICANT: Record<MaskKind, RegExp> = { money: /[\d,]/, phone: /[\d+]/, email: /\S/ }

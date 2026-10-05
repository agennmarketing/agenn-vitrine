const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MAX_CENTS = 99_999_999

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100)
}

// A vírgula sem centavos ("49,") é o que sobra quando a pessoa para de digitar no meio.
const WITH_THOUSANDS = /^\d{1,3}(?:\.\d{3})+(?:,\d{0,2})?$/
const PLAIN = /^\d+(?:,\d{0,2})?$/

export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/i, '').replace(/\s/g, '')
  if (!WITH_THOUSANDS.test(cleaned) && !PLAIN.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.replace(/\./g, '').split(',')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

export function centsToInput(cents: number | null): string {
  if (cents == null) return ''
  const whole = String(Math.trunc(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${whole},${String(cents % 100).padStart(2, '0')}`
}

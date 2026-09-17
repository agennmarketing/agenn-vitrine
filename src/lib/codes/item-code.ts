const ITEM_CODE_PATTERN = /^[A-Z0-9]{1,6}$/

export const ITEM_CODE_MESSAGES = {
  empty: 'Informe um código.',
  format: 'Use até 6 letras ou números.',
  taken: 'Este código já foi usado na sua conta. Escolha outro.',
} as const

export function normalizeItemCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function validateItemCode(input: string): { ok: true; value: string } | { ok: false; reason: 'empty' | 'format' } {
  const value = normalizeItemCode(input)
  if (!value) return { ok: false, reason: 'empty' }
  if (!ITEM_CODE_PATTERN.test(value)) return { ok: false, reason: 'format' }
  return { ok: true, value }
}

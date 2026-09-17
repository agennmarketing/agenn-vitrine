export const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const ORDER_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/

const cryptoBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size))

// 256 é múltiplo de 32: `byte % 32` não favorece nenhum caractere.
export function generateOrderCode(randomBytes: (size: number) => Uint8Array = cryptoBytes): string {
  return Array.from(randomBytes(4), (byte) => ORDER_CODE_ALPHABET[byte % 32]).join('')
}

export function normalizeOrderCode(input: string): string {
  return input.replace(/[#\s]/g, '').toUpperCase()
}

export function isValidOrderCode(value: string): boolean {
  return ORDER_CODE_PATTERN.test(value)
}

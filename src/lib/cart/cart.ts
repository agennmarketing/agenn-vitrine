import type { AddonSelection } from '@/lib/addons/addons'

export const MAX_LINE_QTY = 99
const MAX_LINES = 50

export type CartLine = {
  key: string
  itemId: string
  variationId: string | null
  qty: number
  note: string
  addons: AddonSelection[]
}

export type NewCartLine = Omit<CartLine, 'key'>

export function cartLineKey(line: NewCartLine): string {
  const addons = [...line.addons]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((addon) => `${addon.optionId}x${addon.qty}`)
    .join(',')
  return [line.itemId, line.variationId ?? '-', addons, line.note.trim()].join('|')
}

const clampQty = (qty: number) => Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(qty)))

export function addToCart(lines: CartLine[], line: NewCartLine): CartLine[] {
  const normalized = { ...line, note: line.note.trim() }
  const key = cartLineKey(normalized)
  if (lines.some((existing) => existing.key === key)) {
    return lines.map((existing) => (existing.key === key ? { ...existing, qty: clampQty(existing.qty + line.qty) } : existing))
  }
  if (lines.length >= MAX_LINES) return lines
  return [...lines, { ...normalized, qty: clampQty(line.qty), key }]
}

export function setLineQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (qty < 1) return removeLine(lines, key)
  return lines.map((line) => (line.key === key ? { ...line, qty: clampQty(qty) } : line))
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key)
}

export function replaceLine(lines: CartLine[], key: string, line: NewCartLine): CartLine[] {
  const index = lines.findIndex((existing) => existing.key === key)
  const rest = removeLine(lines, key)
  const normalized = { ...line, note: line.note.trim() }
  const newKey = cartLineKey(normalized)
  const same = rest.find((existing) => existing.key === newKey)
  if (same) return setLineQty(rest, newKey, same.qty + line.qty)
  const next = [...rest]
  next.splice(index < 0 ? next.length : index, 0, { ...normalized, qty: clampQty(line.qty), key: newKey })
  return next
}

export function cartStorageKey(vitrineId: string): string {
  return `agenn-sacola:${vitrineId}`
}

// Validação escrita à mão (sem zod): este arquivo vai para o navegador da vitrine,
// e o zod sozinho pesaria mais que a página. Mesmas regras do formato versão 1.
type StoredLine = Pick<CartLine, 'itemId' | 'variationId' | 'qty' | 'note' | 'addons'>

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

function readLine(value: unknown): StoredLine | null {
  if (!value || typeof value !== 'object') return null
  const line = value as Record<string, unknown>
  if (typeof line.itemId !== 'string' || line.itemId.length < 1) return null
  if (line.variationId !== null && typeof line.variationId !== 'string') return null
  if (!isInt(line.qty, 1, MAX_LINE_QTY)) return null
  if (typeof line.note !== 'string' || line.note.length > 140) return null
  if (!Array.isArray(line.addons) || line.addons.length > 30) return null
  const addons: StoredLine['addons'] = []
  for (const addon of line.addons as unknown[]) {
    if (!addon || typeof addon !== 'object') return null
    const { optionId, qty } = addon as Record<string, unknown>
    if (typeof optionId !== 'string' || optionId.length < 1 || !isInt(qty, 1, 20)) return null
    addons.push({ optionId, qty })
  }
  return { itemId: line.itemId, variationId: line.variationId as string | null, qty: line.qty, note: line.note, addons }
}

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as { version?: unknown; lines?: unknown }
    if (!data || data.version !== 1 || !Array.isArray(data.lines) || data.lines.length > MAX_LINES) return []
    const lines: StoredLine[] = []
    for (const value of data.lines as unknown[]) {
      const line = readLine(value)
      if (!line) return []
      lines.push(line)
    }
    return lines.reduce<CartLine[]>((cart, line) => addToCart(cart, line), [])
  } catch {
    return []
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify({ version: 1, lines: lines.map(({ itemId, variationId, qty, note, addons }) => ({ itemId, variationId, qty, note, addons })) })
}

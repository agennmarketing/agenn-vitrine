import { z } from 'zod'
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

const storedSchema = z.object({
  version: z.literal(1),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        variationId: z.string().nullable(),
        qty: z.number().int().min(1).max(MAX_LINE_QTY),
        note: z.string().max(140),
        addons: z.array(z.object({ optionId: z.string().min(1), qty: z.number().int().min(1).max(20) })).max(30),
      }),
    )
    .max(MAX_LINES),
})

export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return []
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return []
    return parsed.data.lines.reduce<CartLine[]>((lines, line) => addToCart(lines, line), [])
  } catch {
    return []
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify({ version: 1, lines: lines.map(({ key: _key, ...line }) => line) })
}

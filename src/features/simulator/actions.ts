'use server'

import { requireActionUser } from '@/lib/auth/action-user'
import { validateItemCode } from '@/lib/codes/item-code'
import { isValidOrderCode, normalizeOrderCode } from '@/lib/codes/order-code'
import { linesFromSnapshot, type SimulatorItem } from '@/lib/simulator/simulate'

const ITEM_COLUMNS =
  'id, code, name, deleted_at, sold_out, price_type, price_cents, promo_price_cents, vitrines(name), item_variations(id, name, price_cents, promo_price_cents)'

type ItemRow = {
  id: string; code: string; name: string; deleted_at: string | null; sold_out: boolean; price_type: string
  price_cents: number | null; promo_price_cents: number | null; vitrines: { name: string } | null
  item_variations: { id: string; name: string; price_cents: number; promo_price_cents: number | null }[]
}

function toSimulatorItem(row: ItemRow): SimulatorItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    vitrineName: row.vitrines?.name ?? '',
    deleted: row.deleted_at !== null,
    soldOut: row.sold_out,
    priceType: row.price_type as SimulatorItem['priceType'],
    priceCents: row.price_cents,
    promoPriceCents: row.promo_price_cents,
    variations: row.item_variations.map((v) => ({ id: v.id, name: v.name, priceCents: v.price_cents, promoPriceCents: v.promo_price_cents })),
  }
}

export async function lookupOrderAction(input: string) {
  const code = normalizeOrderCode(input)
  if (!isValidOrderCode(code)) return { error: 'Pedido não encontrado ou expirado.' }
  const { supabase } = await requireActionUser()
  const { data: order } = await supabase
    .from('order_snapshots')
    .select('code, payload, created_at')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!order) return { error: 'Pedido não encontrado ou expirado.' }

  const lines = linesFromSnapshot(order.payload)
  const ids = [...new Set(lines.map((line) => line.itemId))]
  const { data: rows } = ids.length ? await supabase.from('items').select(ITEM_COLUMNS).in('id', ids) : { data: [] }
  return {
    code: order.code,
    createdAt: order.created_at,
    lines,
    items: ((rows ?? []) as unknown as ItemRow[]).map(toSimulatorItem),
  }
}

export async function findItemByCodeAction(input: string) {
  const result = validateItemCode(input)
  if (!result.ok) return { error: 'Item não encontrado.' }
  const { supabase } = await requireActionUser()
  const { data: row } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('code', result.value)
    .is('deleted_at', null)
    .maybeSingle()
  if (!row) return { error: 'Item não encontrado.' }
  return { item: toSimulatorItem(row as unknown as ItemRow) }
}

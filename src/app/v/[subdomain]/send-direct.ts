import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { isValidOrderCode } from '@/lib/codes/order-code'
import { buildDirectMessage, buildWhatsAppUrl } from '@/lib/whatsapp/messages'

export type OrderLineRequest = {
  itemId: string
  variationId: string | null
  qty: number
  note: string
}

export async function requestOrderCode(lines: OrderLineRequest[]): Promise<string | null> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return null
    const { code } = (await response.json()) as { code?: unknown }
    return typeof code === 'string' && isValidOrderCode(code) ? code : null
  } catch {
    return null
  }
}

export async function sendDirect(
  vitrine: PublicVitrine,
  item: PublicItem,
  choice: { variation: { id: string; name: string } | null; note: string },
): Promise<void> {
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  if (!phone) return
  const note = choice.note.trim()
  const orderCode = await requestOrderCode([
    { itemId: item.id, variationId: choice.variation?.id ?? null, qty: 1, note },
  ])
  const text = buildDirectMessage({
    vitrineType: vitrine.type,
    vitrineName: vitrine.name,
    itemName: item.name,
    itemCode: item.code,
    variationName: choice.variation?.name ?? null,
    orderCode,
    customTemplate: item.customMessage,
    note: note || null,
  })
  window.location.assign(buildWhatsAppUrl(phone, text))
}

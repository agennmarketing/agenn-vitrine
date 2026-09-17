import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { isValidOrderCode } from '@/lib/codes/order-code'
import { buildDirectMessage, buildWhatsAppUrl } from '@/lib/whatsapp/messages'

export async function requestOrderCode(itemId: string, variationId: string | null): Promise<string | null> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: [{ itemId, variationId, qty: 1 }] }),
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
  variation: { id: string; name: string } | null,
): Promise<void> {
  const phone = item.whatsappPhone ?? vitrine.primaryPhone
  if (!phone) return
  const orderCode = await requestOrderCode(item.id, variation?.id ?? null)
  const text = buildDirectMessage({
    vitrineType: vitrine.type,
    vitrineName: vitrine.name,
    itemName: item.name,
    itemCode: item.code,
    variationName: variation?.name ?? null,
    orderCode,
    customTemplate: item.customMessage,
  })
  window.location.assign(buildWhatsAppUrl(phone, text))
}

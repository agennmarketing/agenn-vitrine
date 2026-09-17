import type { PublicItem, PublicVitrine } from '@/features/public/build-catalog'
import { addonMessageLines } from '@/lib/addons/addons'
import type { CartLine } from '@/lib/cart/cart'
import type { CheckoutValue } from '@/lib/cart/checkout'
import { buildCartMessage } from '@/lib/whatsapp/cart-message'
import { buildWhatsAppUrl } from '@/lib/whatsapp/messages'
import { requestOrderCode } from './send-direct'

// A sacola vai para o WhatsApp principal da vitrine. Falha no código do pedido
// não bloqueia: a mensagem sai sem código (spec 7.5).
export async function buildCartWhatsAppUrl(
  vitrine: PublicVitrine,
  lines: CartLine[],
  items: ReadonlyMap<string, PublicItem>,
  checkout: CheckoutValue,
): Promise<string | null> {
  if (!vitrine.primaryPhone || lines.length === 0) return null
  const orderCode = await requestOrderCode(
    lines.map((line) => ({ itemId: line.itemId, variationId: line.variationId, qty: line.qty, note: line.note, addons: line.addons })),
  )
  const message = buildCartMessage({
    vitrineName: vitrine.name,
    orderCode,
    checkout,
    lines: lines.flatMap((line) => {
      const item = items.get(line.itemId)
      if (!item) return []
      const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) : null
      return [
        {
          qty: line.qty,
          itemName: item.name,
          variationName: variation?.name ?? null,
          code: item.code,
          addonLines: addonMessageLines(item.addonGroups, line.addons),
          note: line.note || null,
        },
      ]
    }),
  })
  return buildWhatsAppUrl(vitrine.primaryPhone, message)
}

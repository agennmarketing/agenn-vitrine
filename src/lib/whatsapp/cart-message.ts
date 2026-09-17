import type { CheckoutValue } from '@/lib/cart/checkout'
import { formatBRL } from '@/lib/money/money'

export type CartMessageLine = {
  qty: number
  itemName: string
  variationName: string | null
  code: string
  addonLines: string[]
  note: string | null
}

export function withNoteLine(addonLines: string[], note: string | null): string[] {
  return note ? [...addonLines, `   • Obs: ${note}`] : addonLines
}

function footer(checkout: CheckoutValue): string | null {
  const parts: string[] = []
  if (checkout.fulfillment === 'retirada') parts.push('Retirada')
  if (checkout.fulfillment === 'entrega') {
    parts.push('Entrega')
    if (checkout.address) parts.push(`Endereço: ${checkout.address}`)
  }
  if (checkout.name) parts.push(`Nome: ${checkout.name}`)
  if (checkout.payment) {
    const change = checkout.changeForCents !== null ? ` (troco para ${formatBRL(checkout.changeForCents)})` : ''
    parts.push(`Pagamento: ${checkout.payment}${change}`)
  }
  if (checkout.schedule) {
    const [, month, day] = checkout.schedule.date.split('-')
    parts.push(`Agendado para ${day}/${month} às ${checkout.schedule.time}`)
  }
  if (checkout.notes) parts.push(`Obs: ${checkout.notes}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// Spec 7.5: a mensagem não leva valores (só o troco).
export function buildCartMessage(input: {
  vitrineName: string
  orderCode: string | null
  lines: CartMessageLine[]
  checkout: CheckoutValue
}): string {
  const header = input.orderCode
    ? `*Pedido #${input.orderCode} – ${input.vitrineName}*`
    : `*Pedido – ${input.vitrineName}*`
  const blocks = input.lines.map((line) => {
    const label = line.variationName ? `${line.itemName} – ${line.variationName}` : line.itemName
    return [`${line.qty}x *${label}* (cód. ${line.code})`, ...withNoteLine(line.addonLines, line.note)].join('\n')
  })
  const end = footer(input.checkout)
  return [header, ...blocks, ...(end ? [end] : [])].join('\n\n')
}

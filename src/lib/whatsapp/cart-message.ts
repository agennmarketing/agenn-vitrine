import type { CheckoutValue } from '@/lib/cart/checkout'
import { formatBRL } from '@/lib/money/money'

export type CartMessageLine = {
  qty: number
  itemName: string
  variationName: string | null
  code: string
  /** Preço de uma unidade já com a variação escolhida; null quando a vitrine esconde preços. */
  unitCents: number | null
  note: string | null
}

function footer(checkout: CheckoutValue): string[] {
  const parts: string[] = []
  if (checkout.name) parts.push(`Nome: ${checkout.name}`)
  if (checkout.fulfillment === 'retirada') parts.push('Entrega: retirada')
  if (checkout.fulfillment === 'entrega') {
    parts.push('Entrega: entrega')
    if (checkout.address) parts.push(`Endereço: ${checkout.address}`)
  }
  if (checkout.payment) {
    const change = checkout.changeForCents !== null ? ` (troco para ${formatBRL(checkout.changeForCents)})` : ''
    parts.push(`Pagamento: ${checkout.payment}${change}`)
  }
  if (checkout.schedule) {
    const [, month, day] = checkout.schedule.date.split('-')
    parts.push(`Agendado para ${day}/${month} às ${checkout.schedule.time}`)
  }
  if (checkout.notes) parts.push(`Observações: ${checkout.notes}`)
  return parts
}

// A mensagem chega pronta no WhatsApp: um bloco numerado por produto, com
// variação, quantidade, valores e observações, e o total no fim.
export function buildCartMessage(input: {
  vitrineName: string
  orderCode: string | null
  lines: CartMessageLine[]
  checkout: CheckoutValue
}): string {
  const header = input.orderCode
    ? `*Pedido #${input.orderCode} – ${input.vitrineName}*`
    : `*Pedido – ${input.vitrineName}*`

  const blocks = input.lines.map((line, index) => {
    const label = line.variationName ? `${line.itemName} – ${line.variationName}` : line.itemName
    const rows = [`*${index + 1}.* ${line.qty}x ${label}`]
    const details = [`cód. ${line.code}`]
    if (line.unitCents !== null) {
      details.push(`${formatBRL(line.unitCents)} cada`, `total ${formatBRL(line.unitCents * line.qty)}`)
    }
    rows.push(details.join(' · '))
    if (line.note) rows.push(`Obs: ${line.note}`)
    return rows.join('\n')
  })

  // Sem preço em algum item (sob consulta ou vitrine sem preços) não há total a somar.
  const priced = input.lines.every((line) => line.unitCents !== null)
  const total = priced
    ? [`*Total: ${formatBRL(input.lines.reduce((sum, line) => sum + line.unitCents! * line.qty, 0))}*`]
    : []

  const end = footer(input.checkout)
  return [header, ...blocks, ...total, ...(end.length > 0 ? [end.join('\n')] : [])].join('\n\n')
}

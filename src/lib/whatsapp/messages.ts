import { bookingDateLabel } from '@/lib/booking/format'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export const MESSAGE_VARIABLES = ['{item}', '{codigo}', '{variacao}', '{vitrine}', '{pedido}'] as const

export type DirectMessageInput = {
  vitrineType: VitrineType
  vitrineName: string
  itemName: string
  itemCode: string
  variationName: string | null
  orderCode: string | null
  customTemplate: string | null
  note?: string | null
}

function itemLabel(itemName: string, variationName: string | null) {
  return variationName ? `${itemName} – ${variationName}` : itemName
}

export function buildDirectMessage(input: DirectMessageInput): string {
  let text: string
  if (input.customTemplate?.trim()) {
    text = input.customTemplate
      .replaceAll('{item}', input.itemName)
      .replaceAll('{codigo}', input.itemCode)
      .replaceAll('{variacao}', input.variationName ?? '')
      .replaceAll('{vitrine}', input.vitrineName)
      .replaceAll('{pedido}', input.orderCode ?? '')
      .trim()
  } else {
    const intent = input.vitrineType === 'servicos' ? 'gostaria de agendar' : 'tenho interesse em'
    const order = input.orderCode ? ` Pedido #${input.orderCode}` : ''
    text = `Olá! Vim da vitrine *${input.vitrineName}* e ${intent}: *${itemLabel(input.itemName, input.variationName)}* (cód. ${input.itemCode}).${order}`
  }
  const blocks = [text]
  if (input.note) blocks.push(`Obs: ${input.note}`)
  return blocks.join('\n\n')
}

// Serviços: depois de confirmar, o cliente pode avisar o negócio com o resumo pronto.
export type BookingMessageInput = {
  vitrineName: string
  serviceName: string
  date: string
  time: string
  priceText: string | null
  customerName: string
  code: string
  notes: string | null
}

export function buildBookingMessage(input: BookingMessageInput): string {
  const lines = [
    `*${input.serviceName}*`,
    `Data: ${bookingDateLabel(input.date)} às ${input.time}`,
    ...(input.priceText ? [`Valor: ${input.priceText}`] : []),
    `Nome: ${input.customerName}`,
    `Agendamento #${input.code}`,
  ]
  const blocks = [`Olá! Acabei de agendar pela vitrine *${input.vitrineName}*:`, lines.join('\n')]
  if (input.notes) blocks.push(`Obs: ${input.notes}`)
  return blocks.join('\n\n')
}

export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}

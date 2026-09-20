import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export const MESSAGE_VARIABLES = ['{item}', '{codigo}', '{variacao}', '{vitrine}', '{pedido}'] as const

// Serviços: o que o cliente preencheu na etapa "Quero esse serviço", mais o preço à vista.
export type ServiceRequestDetails = {
  priceText: string | null
  name: string
  date: string | null
  time: string | null
}

export type DirectMessageInput = {
  vitrineType: VitrineType
  vitrineName: string
  itemName: string
  itemCode: string
  variationName: string | null
  orderCode: string | null
  customTemplate: string | null
  note?: string | null
  request?: ServiceRequestDetails | null
}

function itemLabel(itemName: string, variationName: string | null) {
  return variationName ? `${itemName} – ${variationName}` : itemName
}

function requestLines(request: ServiceRequestDetails): string[] {
  const lines: string[] = []
  if (request.priceText) lines.push(`Valor: ${request.priceText}`)
  lines.push(`Nome: ${request.name}`)
  if (request.date) {
    const [, month, day] = request.date.split('-')
    lines.push(`Data desejada: ${day}/${month}`)
  }
  if (request.time) lines.push(`Horário desejado: ${request.time}`)
  return lines
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
  if (input.request) blocks.push(requestLines(input.request).join('\n'))
  if (input.note) blocks.push(`Obs: ${input.note}`)
  return blocks.join('\n\n')
}

export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}

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
  addonLines?: string[]
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
  const addons = (input.addonLines ?? []).join('\n')
  return addons ? `${text}\n\n${addons}` : text
}

export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
}

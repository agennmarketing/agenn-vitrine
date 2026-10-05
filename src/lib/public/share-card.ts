import { readableTextColor } from '@/lib/color/contrast'

// Imagem de prévia do link da vitrine (WhatsApp, Instagram…): o conteúdo do card.

export type ShareCardInput = {
  subdomain: string
  name: string
  description: string
  brandColor: string | null
  logoUrl: string | null
}

// O mesmo roxo que a vitrine usa sem cor escolhida (app/v/[subdomain]/theme.ts).
const DEFAULT_BRAND = '#673de6'
const MAX_DESCRIPTION = 120

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 }

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

export function shareCard(input: ShareCardInput, rootDomain: string) {
  const background = input.brandColor && /^#[0-9a-f]{6}$/i.test(input.brandColor) ? input.brandColor.toLowerCase() : DEFAULT_BRAND
  const ink = readableTextColor(background)
  const name = input.name.trim()
  return {
    background,
    ink,
    muted: ink === '#ffffff' ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.72)',
    initial: [...name][0]?.toLocaleUpperCase('pt-BR') ?? 'V',
    name,
    description: truncate(input.description.replace(/\s+/g, ' ').trim(), MAX_DESCRIPTION),
    host: `${input.subdomain}.${rootDomain}`,
  }
}

// Vai na URL da imagem (?v=): o WhatsApp guarda a prévia pela URL, então trocar
// logo, nome, descrição ou cor gera um endereço novo e a imagem antiga não fica presa.
export function shareCardVersion(input: ShareCardInput) {
  const text = JSON.stringify([input.name, input.description, input.brandColor, input.logoUrl])
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

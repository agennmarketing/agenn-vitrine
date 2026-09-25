import type { MetadataRoute } from 'next'
import { logoManifestIcons, type SquareImage } from './icons'

/*
 * Manifestos dos dois aplicativos: o painel (o profissional instala para cuidar da
 * vitrine e da agenda) e cada vitrine (o cliente instala a loja em si).
 *
 * O endereço do manifesto do painel mora em `/pwa/` porque `/app/manifest.webmanifest`
 * cairia na convenção de rota de metadados do Next: antes de comparar, ele tira o
 * prefixo `app/` do caminho — e a nossa área do painel se chama justamente `app`. É a
 * mesma armadilha do `sitemap.xml` (ver `internalPathFor`). Na vitrine o caminho fica na
 * raiz do host, que é onde o navegador espera encontrá-lo.
 */

export const VITRINE_MANIFEST_PATH = '/manifest.webmanifest'
export const PAINEL_MANIFEST_PATH = '/pwa/manifest.webmanifest'

// Único ícone do Agenn servido por caminho fixo (o `src/app/icon.png` sai com hash no nome).
const AGENN_ICONS = [{ src: '/brand/vitrimove-marca-512.png', sizes: '512x512', type: 'image/png' }]

const PAINEL_CANVAS = '#f7f6fb'

// Palavras de ligação que não podem sobrar no fim do nome curto ("Studio da" → "Studio").
const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o'])

// Nome curto da tela de início: o Android corta por volta de 12 caracteres, então
// cortamos por palavra em vez de deixar o sistema truncar no meio.
export function shortName(name: string, limit = 12): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length <= limit) return clean
  const words: string[] = []
  let length = 0
  for (const word of clean.split(' ')) {
    const next = length === 0 ? word.length : length + 1 + word.length
    if (next > limit) break
    words.push(word)
    length = next
  }
  while (words.length > 1 && CONNECTORS.has(words[words.length - 1].toLowerCase())) words.pop()
  return words.join(' ') || clean.slice(0, limit).trimEnd()
}

export function vitrineManifest(vitrine: {
  name: string
  description: string
  logo: SquareImage | null
  brandColor: string | null
  backgroundColor: string
}): MetadataRoute.Manifest {
  return {
    id: '/',
    name: vitrine.name,
    short_name: shortName(vitrine.name),
    description: vitrine.description || undefined,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt-BR',
    dir: 'ltr',
    background_color: vitrine.backgroundColor,
    theme_color: vitrine.brandColor ?? vitrine.backgroundColor,
    icons: vitrine.logo ? logoManifestIcons(vitrine.logo) : AGENN_ICONS,
  }
}

export function painelManifest(): MetadataRoute.Manifest {
  return {
    id: '/painel',
    name: 'Agenn',
    short_name: 'Agenn',
    description: 'Cuide da sua vitrine e da sua agenda pelo celular.',
    // Abre direto no painel; quem não está logado cai na tela de entrar, que está no escopo.
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt-BR',
    dir: 'ltr',
    background_color: PAINEL_CANVAS,
    theme_color: '#ffffff',
    icons: AGENN_ICONS,
    shortcuts: [
      { name: 'Minha vitrine', short_name: 'Vitrine', url: '/painel' },
      { name: 'Agenda', short_name: 'Agenda', url: '/painel/agenda' },
    ],
  }
}

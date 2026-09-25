import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { vitrineManifest } from '@/lib/pwa/manifest'
import { vitrineTheme } from '../theme'

// Manifesto da vitrine: é o que faz o cliente poder instalar a loja como aplicativo,
// com o nome e a logo do lojista. Vitrine fora do ar não se instala.
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine || vitrine.status !== 'active') return new Response(null, { status: 404 })

  // O fundo da tela de abertura é o mesmo fundo da vitrine, já tingido pela cor do lojista.
  const { canvas } = vitrineTheme(vitrine.brandColor, vitrine.theme)
  const manifest = vitrineManifest({
    name: vitrine.name,
    description: vitrine.description,
    logo: vitrine.logo,
    brandColor: vitrine.brandColor,
    backgroundColor: canvas,
  })
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  })
}

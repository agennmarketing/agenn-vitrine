import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { SHARE_IMAGE_SIZE, shareCard } from '@/lib/public/share-card'
import { ShareCardImage } from './card'

// Imagem de prévia do link da vitrine. Mora em `/og` (e não no `opengraph-image.tsx` do
// Next) porque a convenção gera o endereço `/v/{subdomain}/…`, que no subdomínio da
// vitrine viraria `/v/{subdomain}/v/{subdomain}/…` no proxy.

const fontDir = join(process.cwd(), 'assets/fonts')
const [medium, extraBold] = await Promise.all([
  readFile(join(fontDir, 'Figtree-Medium.ttf')),
  readFile(join(fontDir, 'Figtree-ExtraBold.ttf')),
])

// A logo é guardada em WebP, que o gerador de imagem não lê: vira PNG aqui. Se algo
// falhar, o card sai com a inicial do nome em vez de quebrar a prévia.
// O `sharp` é carregado em tempo de execução, fora do bundle: empacotado, o Turbopack
// cria um junction point em `.next/node_modules`, que o drive FAT32 do dev não suporta.
// Ele chega ao deploy pelo `outputFileTracingIncludes` do next.config.
async function logoAsPng(url: string | undefined) {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const { default: sharp } = (await import(/* turbopackIgnore: true */ 'sharp')) as typeof import('sharp')
    const png = await sharp(Buffer.from(await response.arrayBuffer())).resize(256, 256, { fit: 'cover' }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch (error) {
    console.error('[og] falha ao preparar a logo', error)
    return null
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) return new Response(null, { status: 404 })

  const card = shareCard(
    { subdomain: vitrine.subdomain, name: vitrine.name, description: vitrine.description, brandColor: vitrine.brandColor, logoUrl: vitrine.logo?.large ?? null },
    env.NEXT_PUBLIC_ROOT_DOMAIN,
  )
  const logo = await logoAsPng(vitrine.logo?.large)

  return new ImageResponse(
    <ShareCardImage card={card} logo={logo} />,
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { name: 'Figtree', data: medium, weight: 500, style: 'normal' },
        { name: 'Figtree', data: extraBold, weight: 800, style: 'normal' },
      ],
      headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' },
    },
  )
}

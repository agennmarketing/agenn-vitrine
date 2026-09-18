import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { sitemapXml } from '@/lib/public/sitemap'

// Cada item tem link próprio pela query `?item={código}` (spec 7.3).
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine || vitrine.status !== 'active') return new Response(null, { status: 404 })

  const base = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
  const items = vitrine.categories.flatMap((category) => category.items)
  const xml = sitemapXml([
    { loc: `${base}/` },
    ...items.map((item) => ({ loc: `${base}/?item=${item.code}` })),
  ])
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}

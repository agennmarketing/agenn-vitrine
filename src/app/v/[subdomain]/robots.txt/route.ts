import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { robotsTxt } from '@/lib/public/robots'

const TEXT = { headers: { 'content-type': 'text/plain; charset=utf-8' } }

// Vitrine congelada ou inexistente não deve ser indexada (spec 7.1).
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine || vitrine.status !== 'active') return new Response(robotsTxt({ allow: false }), TEXT)

  const base = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
  return new Response(robotsTxt({ allow: true, sitemapUrl: `${base}/sitemap.xml` }), TEXT)
}

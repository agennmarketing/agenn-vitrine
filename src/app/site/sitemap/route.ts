import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { sitemapXml } from '@/lib/public/sitemap'
import { PERSONAS } from '../_vendas/personas'

export async function GET() {
  const base = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)
  const xml = sitemapXml([
    { loc: `${base}/` },
    ...PERSONAS.map((persona) => ({ loc: `${base}/${persona.slug}` })),
    { loc: `${base}/termos` },
    { loc: `${base}/privacidade` },
  ])
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}

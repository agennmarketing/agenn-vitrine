import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { sitemapXml } from '@/lib/public/sitemap'

export async function GET() {
  const base = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)
  const xml = sitemapXml([{ loc: `${base}/` }, { loc: `${base}/termos` }, { loc: `${base}/privacidade` }])
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}

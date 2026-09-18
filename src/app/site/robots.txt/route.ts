import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { robotsTxt } from '@/lib/public/robots'

export async function GET() {
  const base = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)
  return new Response(robotsTxt({ allow: true, sitemapUrl: `${base}/sitemap.xml` }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

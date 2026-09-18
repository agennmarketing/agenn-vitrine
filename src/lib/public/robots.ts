export function robotsTxt(input: { allow: boolean; sitemapUrl?: string }): string {
  const lines = ['User-agent: *', input.allow ? 'Allow: /' : 'Disallow: /']
  if (input.allow && input.sitemapUrl) lines.push('', `Sitemap: ${input.sitemapUrl}`)
  return `${lines.join('\n')}\n`
}

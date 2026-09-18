import { describe, expect, it } from 'vitest'
import { sitemapXml } from './sitemap'

describe('sitemapXml', () => {
  it('monta o XML com as URLs', () => {
    const xml = sitemapXml([
      { loc: 'https://loja.agenn.com.br/', lastmod: '2026-09-18' },
      { loc: 'https://loja.agenn.com.br/?item=101' },
    ])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<loc>https://loja.agenn.com.br/</loc>')
    expect(xml).toContain('<lastmod>2026-09-18</lastmod>')
    expect(xml).toContain('<loc>https://loja.agenn.com.br/?item=101</loc>')
  })

  it('escapa o que o XML não aceita cru', () => {
    expect(sitemapXml([{ loc: 'https://x.com/?a=1&b=2' }])).toContain('?a=1&amp;b=2')
  })

  it('aceita lista vazia', () => {
    expect(sitemapXml([])).toContain('<urlset')
  })
})

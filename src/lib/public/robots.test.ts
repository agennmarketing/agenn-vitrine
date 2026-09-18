import { describe, expect, it } from 'vitest'
import { robotsTxt } from './robots'

describe('robotsTxt', () => {
  it('libera e aponta o sitemap', () => {
    expect(robotsTxt({ allow: true, sitemapUrl: 'https://loja.agenn.com.br/sitemap.xml' })).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://loja.agenn.com.br/sitemap.xml\n',
    )
  })

  it('bloqueia tudo quando não há o que indexar', () => {
    expect(robotsTxt({ allow: false })).toBe('User-agent: *\nDisallow: /\n')
  })
})

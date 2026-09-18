import { describe, expect, it } from 'vitest'
import { internalPathFor, parseHost } from './parse-host'

const prod = { rootDomain: 'agennvitrine.com.br', legacyDomains: ['agenn.com.br'] }
const local = { rootDomain: 'localhost:3000', legacyDomains: [] }

describe('parseHost', () => {
  it('domínio raiz e www vão para a página inicial', () => {
    expect(parseHost('agennvitrine.com.br', prod)).toEqual({ type: 'marketing' })
    expect(parseHost('www.agennvitrine.com.br', prod)).toEqual({ type: 'marketing' })
    expect(parseHost('localhost:3000', local)).toEqual({ type: 'marketing' })
  })

  it('app. vai para o painel', () => {
    expect(parseHost('app.agennvitrine.com.br', prod)).toEqual({ type: 'app' })
    expect(parseHost('APP.localhost:3000', local)).toEqual({ type: 'app' })
  })

  it('subdomínio válido vai para a vitrine', () => {
    expect(parseHost('burgerdoze.agennvitrine.com.br', prod)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
    expect(parseHost('burgerdoze.localhost:3000', local)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
    expect(parseHost('burgerdoze.agennvitrine.com.br.', prod)).toEqual({ type: 'vitrine', subdomain: 'burgerdoze' })
  })

  it('domínio antigo redireciona preservando o subdomínio', () => {
    expect(parseHost('agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'agennvitrine.com.br' })
    expect(parseHost('burgerdoze.agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'burgerdoze.agennvitrine.com.br' })
    expect(parseHost('app.agenn.com.br', prod)).toEqual({ type: 'redirect', host: 'app.agennvitrine.com.br' })
  })

  it('prévia da Vercel vale como painel', () => {
    expect(parseHost('agenn-vitrine-v1-git-fase-6.vercel.app', prod)).toEqual({ type: 'app' })
    expect(parseHost('agenn-vitrine-v1.vercel.app', prod)).toEqual({ type: 'app' })
  })

  it('não confunde um domínio que só termina parecido', () => {
    expect(parseHost('vercel.app.golpe.com', prod)).toEqual({ type: 'invalid' })
  })

  it('hosts inválidos', () => {
    expect(parseHost(null, prod)).toEqual({ type: 'invalid' })
    expect(parseHost('outro.com', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('a.b.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('api.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('xy.agennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
    expect(parseHost('fakeagennvitrine.com.br', prod)).toEqual({ type: 'invalid' })
  })
})

describe('internalPathFor', () => {
  it('prefixa o caminho conforme o destino', () => {
    expect(internalPathFor({ type: 'marketing' }, '/')).toBe('/site')
    expect(internalPathFor({ type: 'marketing' }, '/precos')).toBe('/site/precos')
    expect(internalPathFor({ type: 'app' }, '/painel/conta')).toBe('/app/painel/conta')
    expect(internalPathFor({ type: 'vitrine', subdomain: 'burgerdoze' }, '/')).toBe('/v/burgerdoze')
    expect(internalPathFor({ type: 'invalid' }, '/qualquer')).toBe('/host-invalido')
    expect(internalPathFor({ type: 'redirect', host: 'x' }, '/qualquer')).toBe('/host-invalido')
  })

  it('desvia /sitemap.xml do nome reservado pelo Next, sem afetar outros caminhos', () => {
    expect(internalPathFor({ type: 'vitrine', subdomain: 'burgerdoze' }, '/sitemap.xml')).toBe(
      '/v/burgerdoze/sitemap',
    )
    expect(internalPathFor({ type: 'marketing' }, '/sitemap.xml')).toBe('/site/sitemap')
    // robots.txt não é nome reservado: continua mapeado 1:1, como antes.
    expect(internalPathFor({ type: 'vitrine', subdomain: 'burgerdoze' }, '/robots.txt')).toBe(
      '/v/burgerdoze/robots.txt',
    )
    expect(internalPathFor({ type: 'marketing' }, '/robots.txt')).toBe('/site/robots.txt')
  })
})

import { describe, expect, it } from 'vitest'
import { buildAppUrl, buildVitrineUrl, originFor, safeNextPath } from './urls'

describe('urls', () => {
  it('usa http em localhost e https no resto', () => {
    expect(originFor('app.localhost:3000')).toBe('http://app.localhost:3000')
    expect(originFor('localhost:3000')).toBe('http://localhost:3000')
    expect(originFor('app.agenn.com.br')).toBe('https://app.agenn.com.br')
  })

  it('monta URLs do app e da vitrine', () => {
    expect(buildAppUrl('/auth/callback', 'agenn.com.br')).toBe('https://app.agenn.com.br/auth/callback')
    expect(buildVitrineUrl('burgerdoze', 'localhost:3000')).toBe('http://burgerdoze.localhost:3000')
  })

  it('safeNextPath só aceita caminhos internos', () => {
    expect(safeNextPath('/painel/conta')).toBe('/painel/conta')
    expect(safeNextPath(null)).toBe('/painel')
    expect(safeNextPath('https://mal.com')).toBe('/painel')
    expect(safeNextPath('//mal.com')).toBe('/painel')
    expect(safeNextPath('/\\mal.com')).toBe('/painel')
    expect(safeNextPath('', '/entrar')).toBe('/entrar')
  })

  it('safeNextPath recusa caracteres de controle e espaços', () => {
    expect(safeNextPath('/\t/mal.com')).toBe('/painel')
    expect(safeNextPath('/\n/mal.com')).toBe('/painel')
    expect(safeNextPath('/\r\n/mal.com')).toBe('/painel')
    expect(safeNextPath('/ /mal.com')).toBe('/painel')
    expect(safeNextPath('/painel/conta?aba=senha')).toBe('/painel/conta?aba=senha')
  })
})

import { describe, expect, it } from 'vitest'
import { shareCard, shareCardVersion } from './share-card'

const base = {
  subdomain: 'studio-ana',
  name: 'Studio Ana Nails',
  description: 'Unhas em gel e manicure',
  brandColor: '#ffd84d',
  logoUrl: 'https://cdn.exemplo.com/logo-512.webp',
}

describe('shareCard', () => {
  it('usa a cor da marca e o texto que mais contrasta com ela', () => {
    const card = shareCard(base, 'vitrimove.site')
    expect(card.background).toBe('#ffd84d')
    expect(card.ink).toBe('#000000')
    expect(card.muted).toBe('rgba(0, 0, 0, 0.72)')
    expect(card.host).toBe('studio-ana.vitrimove.site')
    expect(card.name).toBe('Studio Ana Nails')
    expect(card.description).toBe('Unhas em gel e manicure')
  })

  it('sem cor escolhida usa o roxo padrão da vitrine com texto branco', () => {
    const card = shareCard({ ...base, brandColor: null }, 'vitrimove.site')
    expect(card.background).toBe('#673de6')
    expect(card.ink).toBe('#ffffff')
  })

  it('ignora cor inválida', () => {
    expect(shareCard({ ...base, brandColor: 'roxo' }, 'vitrimove.site').background).toBe('#673de6')
  })

  it('a inicial do nome substitui a logo, com acento', () => {
    expect(shareCard({ ...base, name: '  ótica Bela' }, 'vitrimove.site').initial).toBe('Ó')
    expect(shareCard({ ...base, name: '' }, 'vitrimove.site').initial).toBe('V')
  })

  it('corta descrição longa na última palavra inteira', () => {
    const description = 'palavra '.repeat(40).trim()
    const card = shareCard({ ...base, description }, 'vitrimove.site')
    expect(card.description.length).toBeLessThanOrEqual(121)
    expect(card.description.endsWith('palavra…')).toBe(true)
  })

  it('junta quebras de linha da descrição numa linha só', () => {
    expect(shareCard({ ...base, description: 'Linha 1\n\nLinha 2' }, 'vitrimove.site').description).toBe('Linha 1 Linha 2')
  })
})

describe('shareCardVersion', () => {
  it('é estável para os mesmos dados', () => {
    expect(shareCardVersion(base)).toBe(shareCardVersion({ ...base }))
    expect(shareCardVersion(base)).toMatch(/^[0-9a-z]+$/)
  })

  it('muda quando nome, descrição, cor ou logo mudam', () => {
    const v = shareCardVersion(base)
    expect(shareCardVersion({ ...base, name: 'Outro' })).not.toBe(v)
    expect(shareCardVersion({ ...base, description: 'Outra' })).not.toBe(v)
    expect(shareCardVersion({ ...base, brandColor: '#000000' })).not.toBe(v)
    expect(shareCardVersion({ ...base, logoUrl: null })).not.toBe(v)
  })
})

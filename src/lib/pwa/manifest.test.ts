import { describe, expect, it } from 'vitest'
import { painelManifest, shortName, vitrineManifest } from './manifest'

const logo = {
  small: 'https://cdn.exemplo.net/dono/vitrine/abc-128.webp',
  large: 'https://cdn.exemplo.net/dono/vitrine/abc-512.webp',
  smallWidth: 128,
  largeWidth: 512,
}

const base = { name: 'Studio Fernanda', description: 'Manicure e estética', logo, brandColor: '#e0457b', backgroundColor: '#fbf6f8' }

describe('shortName', () => {
  it('mantém nomes curtos', () => {
    expect(shortName('Viva Casa')).toBe('Viva Casa')
  })

  it('corta por palavra quando o nome é longo', () => {
    expect(shortName('Studio Fernanda')).toBe('Studio')
  })

  it('não deixa palavra de ligação sobrando no fim', () => {
    expect(shortName('Studio da Ana')).toBe('Studio')
    expect(shortName('Casa de Bolos Doces')).toBe('Casa')
  })

  it('corta no meio só quando a primeira palavra já estoura', () => {
    expect(shortName('Superhamburgueria')).toBe('Superhamburg')
  })

  it('normaliza espaços', () => {
    expect(shortName('  Viva   Casa  ')).toBe('Viva Casa')
  })
})

describe('vitrineManifest', () => {
  it('descreve a vitrine como aplicativo próprio, com a logo do lojista', () => {
    const manifest = vitrineManifest(base)
    expect(manifest.name).toBe('Studio Fernanda')
    expect(manifest.short_name).toBe('Studio')
    expect(manifest.description).toBe('Manicure e estética')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#e0457b')
    expect(manifest.background_color).toBe('#fbf6f8')
    expect(manifest.icons).toEqual([
      { src: logo.small, sizes: '128x128', type: 'image/webp' },
      { src: logo.large, sizes: '512x512', type: 'image/webp' },
    ])
  })

  it('sem logo, cai no símbolo do Agenn; sem cor, no fundo da própria vitrine', () => {
    const manifest = vitrineManifest({ ...base, logo: null, brandColor: null, description: '' })
    expect(manifest.icons).toEqual([{ src: '/brand/vitrimove-marca-512.png', sizes: '512x512', type: 'image/png' }])
    expect(manifest.theme_color).toBe('#fbf6f8')
    expect(manifest.description).toBeUndefined()
  })
})

describe('painelManifest', () => {
  it('abre no painel e tem atalhos para vitrine e agenda', () => {
    const manifest = painelManifest()
    expect(manifest.name).toBe('Agenn')
    expect(manifest.start_url).toBe('/painel')
    expect(manifest.scope).toBe('/')
    expect(manifest.shortcuts?.map((shortcut) => shortcut.url)).toEqual(['/painel', '/painel/agenda'])
    expect(manifest.icons?.[0].sizes).toBe('512x512')
  })
})

import { describe, expect, it } from 'vitest'
import { imageMimeType, logoManifestIcons, logoMetadataIcons } from './icons'

const logo = {
  small: 'https://cdn.exemplo.net/dono/vitrine/abc-128.webp',
  large: 'https://cdn.exemplo.net/dono/vitrine/abc-512.webp',
  smallWidth: 128,
  largeWidth: 512,
}

describe('imageMimeType', () => {
  it('reconhece os formatos que o envio grava', () => {
    expect(imageMimeType('/a/b-512.webp')).toBe('image/webp')
    expect(imageMimeType('/a/b-512.jpg')).toBe('image/jpeg')
    expect(imageMimeType('/a/b-512.jpeg')).toBe('image/jpeg')
    expect(imageMimeType('/a/b-512.png')).toBe('image/png')
  })

  it('ignora a query e desiste do que não conhece', () => {
    expect(imageMimeType('/a/b-512.webp?v=2')).toBe('image/webp')
    expect(imageMimeType('/api/dev-media/sem-extensao')).toBeUndefined()
  })
})

describe('logoManifestIcons', () => {
  it('declara as duas larguras quadradas da logo', () => {
    expect(logoManifestIcons(logo)).toEqual([
      { src: logo.small, sizes: '128x128', type: 'image/webp' },
      { src: logo.large, sizes: '512x512', type: 'image/webp' },
    ])
  })
})

describe('logoMetadataIcons', () => {
  it('usa a logo como favicon e como ícone da tela de início', () => {
    expect(logoMetadataIcons(logo)).toEqual({
      icon: [
        { url: logo.small, sizes: '128x128', type: 'image/webp' },
        { url: logo.large, sizes: '512x512', type: 'image/webp' },
      ],
      apple: [{ url: logo.large, sizes: '512x512', type: 'image/webp' }],
    })
  })
})

import { expect, it } from 'vitest'
import { imageSources, mediaUrl, storagePathList } from './urls'

const paths = { '1080': 'u/v/m-1080.webp', '480': 'u/v/m-480.webp' }

it('monta URLs públicas', () => {
  expect(mediaUrl('u/v/m-480.webp', 'https://cdn.exemplo.com')).toBe('https://cdn.exemplo.com/u/v/m-480.webp')
  expect(mediaUrl('/u/a.webp', '/api/dev-media/')).toBe('/api/dev-media/u/a.webp')
})

it('lista caminhos e escolhe menor e maior', () => {
  expect(storagePathList(paths).sort()).toEqual(['u/v/m-1080.webp', 'u/v/m-480.webp'])
  expect(storagePathList(null)).toEqual([])
  expect(imageSources(paths, 'https://cdn.exemplo.com')).toEqual({
    small: 'https://cdn.exemplo.com/u/v/m-480.webp',
    large: 'https://cdn.exemplo.com/u/v/m-1080.webp',
    smallWidth: 480,
    largeWidth: 1080,
  })
  expect(imageSources({}, 'x')).toBeNull()
})

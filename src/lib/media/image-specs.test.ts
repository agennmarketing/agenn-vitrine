import { expect, it } from 'vitest'
import { heightFor, IMAGE_SPECS } from './image-specs'

it('tamanhos por papel (spec 6.1)', () => {
  expect(IMAGE_SPECS.cover.widths).toEqual([480, 1080])
  expect([heightFor('cover', 480), heightFor('cover', 1080)]).toEqual([600, 1350])
  expect([heightFor('banner', 960), heightFor('banner', 1920)]).toEqual([540, 1080])
  expect([heightFor('logo', 128), heightFor('logo', 512)]).toEqual([128, 512])
})

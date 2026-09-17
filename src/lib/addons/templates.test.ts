import { expect, it } from 'vitest'
import { ADDON_TEMPLATES } from './templates'

it('modelos prontos da spec 8.4, todos válidos', () => {
  expect(ADDON_TEMPLATES.map((t) => t.label)).toEqual([
    'Ponto da carne',
    'Adicionais',
    'Molhos',
    'Tamanho',
    'Sabores de pizza',
    'Bebida do combo',
  ])
  for (const { group, options } of ADDON_TEMPLATES) {
    expect(options.length).toBeGreaterThan(0)
    expect(group.minSelect).toBeLessThanOrEqual(group.maxSelect)
    expect(group.required).toBe(group.minSelect > 0)
    expect(group.kind === 'flavors').toBe(group.flavorPriceRule !== null)
    if (group.kind === 'flavors') expect(group.allowRepeat).toBe(false)
  }
})

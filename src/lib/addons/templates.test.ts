import { expect, it } from 'vitest'
import { ADDON_TEMPLATES, templatesFor } from './templates'

it('modelos prontos da spec 8.4, todos válidos', () => {
  for (const { group, options, types } of ADDON_TEMPLATES) {
    expect(types.length).toBeGreaterThan(0)
    expect(options.length).toBeGreaterThan(0)
    expect(group.minSelect).toBeLessThanOrEqual(group.maxSelect)
    expect(group.required).toBe(group.minSelect > 0)
    expect(group.kind === 'flavors').toBe(group.flavorPriceRule !== null)
    if (group.kind === 'flavors') expect(group.allowRepeat).toBe(false)
  }
})

it('cada tipo de vitrine vê só os modelos que fazem sentido para ele', () => {
  expect(templatesFor('produtos').map((t) => t.label)).toEqual([
    'Tamanho (P, M, G)',
    'Cor',
    'Embalagem para presente',
    'Personalização',
  ])
  expect(templatesFor('servicos').map((t) => t.label)).toEqual(['Profissional', 'Período', 'Serviços extras'])
  // Só existem produtos e serviços: nenhum modelo sobrou para as vitrines antigas de comida.
  expect(templatesFor('comida')).toEqual([])
  for (const type of ['produtos', 'servicos'] as const) {
    expect(templatesFor(type).some((t) => t.group.kind === 'flavors')).toBe(false)
  }
})

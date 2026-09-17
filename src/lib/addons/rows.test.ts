import { expect, it } from 'vitest'
import { groupsFromLinks, toAddonGroup } from './rows'

it('linha do banco vira AddonGroup com opções em ordem', () => {
  expect(
    toAddonGroup({
      id: 'g', name: 'Sabores', kind: 'flavors', required: true, min_select: 1, max_select: 2, allow_repeat: false,
      flavor_price_rule: 'average', position: 0,
      addon_options: [
        { id: 'b', name: 'Marguerita', price_cents: 4590, sold_out: true, position: 1 },
        { id: 'a', name: 'Calabresa', price_cents: 4990, sold_out: false, position: 0 },
      ],
    }),
  ).toEqual({
    id: 'g', name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'average',
    options: [
      { id: 'a', name: 'Calabresa', priceCents: 4990, soldOut: false },
      { id: 'b', name: 'Marguerita', priceCents: 4590, soldOut: true },
    ],
  })
})

it('groupsFromLinks ordena pelos vínculos e ignora grupo ausente', () => {
  const row = (id: string) => ({
    id, name: id, kind: 'standard', required: false, min_select: 0, max_select: 1, allow_repeat: false,
    flavor_price_rule: null, position: 0, addon_options: [],
  })
  expect(groupsFromLinks([
    { position: 1, addon_groups: row('b') },
    { position: 0, addon_groups: row('a') },
    { position: 2, addon_groups: null },
  ]).map((group) => group.id)).toEqual(['a', 'b'])
})

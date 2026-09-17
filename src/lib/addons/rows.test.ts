import { expect, it } from 'vitest'
import { toAddonGroup } from './rows'

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

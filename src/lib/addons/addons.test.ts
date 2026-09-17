import { describe, expect, it } from 'vitest'
import { addonMessageLines, addonsUnitCents, groupBadge, validateAddonSelections, type AddonGroup } from './addons'

const ponto: AddonGroup = {
  id: 'g-ponto', name: 'Ponto', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
  options: [
    { id: 'o-mal', name: 'Mal passado', priceCents: 0, soldOut: false },
    { id: 'o-ponto', name: 'Ao ponto', priceCents: 0, soldOut: false },
  ],
}
const adicionais: AddonGroup = {
  id: 'g-adic', name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null,
  options: [
    { id: 'o-bacon', name: 'Bacon', priceCents: 400, soldOut: false },
    { id: 'o-cheddar', name: 'Cheddar', priceCents: 300, soldOut: false },
    { id: 'o-ovo', name: 'Ovo', priceCents: 250, soldOut: true },
  ],
}
const sabores: AddonGroup = {
  id: 'g-sab', name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'average',
  options: [
    { id: 'o-cala', name: 'Calabresa', priceCents: 4990, soldOut: false },
    { id: 'o-4q', name: 'Quatro queijos', priceCents: 5491, soldOut: false },
  ],
}

describe('groupBadge (spec 7.3)', () => {
  it('obrigatório e opcional', () => {
    expect(groupBadge(ponto)).toBe('Obrigatório · escolha 1')
    expect(groupBadge(sabores)).toBe('Obrigatório · escolha 1 a 2')
    expect(groupBadge(adicionais)).toBe('Opcional · até 5')
  })
})

describe('validateAddonSelections', () => {
  it('aceita, junta repetidas e ordena como os grupos', () => {
    expect(
      validateAddonSelections([ponto, adicionais], [
        { optionId: 'o-cheddar', qty: 1 },
        { optionId: 'o-bacon', qty: 1 },
        { optionId: 'o-ponto', qty: 1 },
        { optionId: 'o-bacon', qty: 1 },
      ]),
    ).toEqual({
      ok: true,
      selections: [
        { optionId: 'o-ponto', qty: 1 },
        { optionId: 'o-bacon', qty: 2 },
        { optionId: 'o-cheddar', qty: 1 },
      ],
    })
  })

  it('obrigatório sem escolha', () => {
    expect(validateAddonSelections([ponto], [])).toEqual({ ok: false, groupId: 'g-ponto', message: 'Escolha uma opção em Ponto.' })
    expect(validateAddonSelections([{ ...sabores, minSelect: 2 }], [{ optionId: 'o-cala', qty: 1 }])).toEqual({
      ok: false,
      groupId: 'g-sab',
      message: 'Escolha pelo menos 2 opções em Sabores.',
    })
  })

  it('passar do máximo, repetir sem permissão, esgotado e opção desconhecida', () => {
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-bacon', qty: 6 }])).toEqual({
      ok: false,
      groupId: 'g-adic',
      message: 'Escolha até 5 opções em Adicionais.',
    })
    expect(validateAddonSelections([ponto], [{ optionId: 'o-ponto', qty: 2 }])).toEqual({
      ok: false,
      groupId: 'g-ponto',
      message: 'Em Ponto, escolha cada opção só uma vez.',
    })
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-ovo', qty: 1 }])).toEqual({
      ok: false,
      groupId: 'g-adic',
      message: 'Ovo está esgotado.',
    })
    expect(validateAddonSelections([ponto], [{ optionId: 'x', qty: 1 }])).toEqual({
      ok: false,
      groupId: null,
      message: 'Uma opção escolhida não está mais disponível.',
    })
    expect(validateAddonSelections([adicionais], [{ optionId: 'o-bacon', qty: 0 }]).ok).toBe(false)
  })
})

describe('addonsUnitCents (spec 4.6)', () => {
  it('padrão: soma preço × quantidade', () => {
    expect(addonsUnitCents([adicionais], [{ optionId: 'o-bacon', qty: 2 }, { optionId: 'o-cheddar', qty: 1 }])).toBe(1100)
  })

  it('sabores: maior preço ou média arredondada para cima', () => {
    const escolha = [{ optionId: 'o-cala', qty: 1 }, { optionId: 'o-4q', qty: 1 }]
    expect(addonsUnitCents([sabores], escolha)).toBe(5241)
    expect(addonsUnitCents([{ ...sabores, flavorPriceRule: 'max' }], escolha)).toBe(5491)
    expect(addonsUnitCents([sabores], [])).toBe(0)
  })

  it('soma grupos diferentes', () => {
    expect(addonsUnitCents([ponto, adicionais, sabores], [
      { optionId: 'o-ponto', qty: 1 },
      { optionId: 'o-bacon', qty: 1 },
      { optionId: 'o-cala', qty: 1 },
    ])).toBe(5390)
  })
})

it('addonMessageLines no formato da mensagem (spec 7.5)', () => {
  expect(
    addonMessageLines([ponto, adicionais], [
      { optionId: 'o-bacon', qty: 2 },
      { optionId: 'o-ponto', qty: 1 },
      { optionId: 'o-cheddar', qty: 1 },
    ]),
  ).toEqual(['   • Ponto: Ao ponto', '   • Adicionais: 2x Bacon, 1x Cheddar'])
})

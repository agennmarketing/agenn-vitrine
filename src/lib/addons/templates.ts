import type { AddonGroup } from './addons'

export type AddonTemplate = {
  key: string
  label: string
  group: Omit<AddonGroup, 'id' | 'options'>
  options: { name: string; priceCents: number }[]
}

// Spec 8.4: modelos prontos. Preenchem o formulário; o dono ajusta e salva.
export const ADDON_TEMPLATES: AddonTemplate[] = [
  {
    key: 'ponto',
    label: 'Ponto da carne',
    group: { name: 'Ponto da carne', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Mal passado', priceCents: 0 },
      { name: 'Ao ponto', priceCents: 0 },
      { name: 'Bem passado', priceCents: 0 },
    ],
  },
  {
    key: 'adicionais',
    label: 'Adicionais',
    group: { name: 'Adicionais', kind: 'standard', required: false, minSelect: 0, maxSelect: 5, allowRepeat: true, flavorPriceRule: null },
    options: [
      { name: 'Bacon', priceCents: 400 },
      { name: 'Cheddar', priceCents: 300 },
      { name: 'Ovo', priceCents: 250 },
      { name: 'Cebola caramelizada', priceCents: 300 },
    ],
  },
  {
    key: 'molhos',
    label: 'Molhos',
    group: { name: 'Molhos', kind: 'standard', required: false, minSelect: 0, maxSelect: 3, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Maionese da casa', priceCents: 0 },
      { name: 'Barbecue', priceCents: 0 },
      { name: 'Mostarda e mel', priceCents: 0 },
    ],
  },
  {
    key: 'tamanho',
    label: 'Tamanho',
    group: { name: 'Tamanho', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Pequeno', priceCents: 0 },
      { name: 'Médio', priceCents: 500 },
      { name: 'Grande', priceCents: 1000 },
    ],
  },
  {
    key: 'sabores',
    label: 'Sabores de pizza',
    group: { name: 'Sabores', kind: 'flavors', required: true, minSelect: 1, maxSelect: 2, allowRepeat: false, flavorPriceRule: 'max' },
    options: [
      { name: 'Calabresa', priceCents: 4990 },
      { name: 'Marguerita', priceCents: 4590 },
      { name: 'Frango com catupiry', priceCents: 5290 },
      { name: 'Quatro queijos', priceCents: 5490 },
    ],
  },
  {
    key: 'bebida',
    label: 'Bebida do combo',
    group: { name: 'Bebida', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Coca-Cola lata', priceCents: 0 },
      { name: 'Guaraná lata', priceCents: 0 },
      { name: 'Água sem gás', priceCents: 0 },
    ],
  },
]

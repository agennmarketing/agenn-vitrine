import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import type { AddonGroup } from './addons'

export type AddonTemplate = {
  key: string
  label: string
  /** Tipos de vitrine em que o modelo aparece (ponto da carne não faz sentido numa loja de roupas). */
  types: VitrineType[]
  group: Omit<AddonGroup, 'id' | 'options'>
  options: { name: string; priceCents: number }[]
}

// Spec 8.4: modelos prontos. Preenchem o formulário; o dono ajusta e salva. Cada tipo de vitrine vê os seus.
export const ADDON_TEMPLATES: AddonTemplate[] = [
  {
    key: 'ponto',
    types: ['comida'],
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
    types: ['comida'],
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
    types: ['comida'],
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
    types: ['comida'],
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
    types: ['comida'],
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
    types: ['comida'],
    label: 'Bebida do combo',
    group: { name: 'Bebida', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Coca-Cola lata', priceCents: 0 },
      { name: 'Guaraná lata', priceCents: 0 },
      { name: 'Água sem gás', priceCents: 0 },
    ],
  },
  {
    key: 'tamanho-roupa',
    types: ['produtos'],
    label: 'Tamanho (P, M, G)',
    group: { name: 'Tamanho', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'P', priceCents: 0 },
      { name: 'M', priceCents: 0 },
      { name: 'G', priceCents: 0 },
      { name: 'GG', priceCents: 0 },
    ],
  },
  {
    key: 'cor',
    types: ['produtos'],
    label: 'Cor',
    group: { name: 'Cor', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Preto', priceCents: 0 },
      { name: 'Branco', priceCents: 0 },
      { name: 'Azul', priceCents: 0 },
    ],
  },
  {
    key: 'presente',
    types: ['produtos'],
    label: 'Embalagem para presente',
    group: { name: 'Embalagem', kind: 'standard', required: false, minSelect: 0, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Embalagem para presente', priceCents: 500 },
      { name: 'Cartão com mensagem', priceCents: 300 },
    ],
  },
  {
    key: 'personalizacao',
    types: ['produtos'],
    label: 'Personalização',
    group: { name: 'Personalização', kind: 'standard', required: false, minSelect: 0, maxSelect: 2, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Nome gravado', priceCents: 1000 },
      { name: 'Estampa própria', priceCents: 1500 },
    ],
  },
  {
    key: 'profissional',
    types: ['servicos'],
    label: 'Profissional',
    group: { name: 'Profissional', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Sem preferência', priceCents: 0 },
      { name: 'Profissional 1', priceCents: 0 },
      { name: 'Profissional 2', priceCents: 0 },
    ],
  },
  {
    key: 'periodo',
    types: ['servicos'],
    label: 'Período',
    group: { name: 'Período', kind: 'standard', required: true, minSelect: 1, maxSelect: 1, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Manhã', priceCents: 0 },
      { name: 'Tarde', priceCents: 0 },
      { name: 'Noite', priceCents: 0 },
    ],
  },
  {
    key: 'extras-servico',
    types: ['servicos'],
    label: 'Serviços extras',
    group: { name: 'Extras', kind: 'standard', required: false, minSelect: 0, maxSelect: 3, allowRepeat: false, flavorPriceRule: null },
    options: [
      { name: 'Atendimento a domicílio', priceCents: 3000 },
      { name: 'Material incluso', priceCents: 1500 },
      { name: 'Horário fora do expediente', priceCents: 2000 },
    ],
  },
]

export function templatesFor(type: VitrineType) {
  return ADDON_TEMPLATES.filter((template) => template.types.includes(type))
}

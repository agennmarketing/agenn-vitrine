export const VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const
export type VitrineType = (typeof VITRINE_TYPES)[number]

export const WIZARD_VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const satisfies readonly VitrineType[]

export const VITRINE_TYPE_LABEL: Record<VitrineType, string> = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  comida: 'Comida',
}

export const DEFAULT_BUTTON_TEXT: Record<VitrineType, string> = {
  produtos: 'Solicitar orçamento',
  servicos: 'Agendar',
  comida: 'Pedir',
}

export const SAMPLE_CATEGORIES: Record<VitrineType, readonly string[]> = {
  produtos: ['Destaques', 'Novidades'],
  servicos: ['Serviços', 'Pacotes'],
  comida: ['Lanches', 'Bebidas'],
}

// A tabela `vitrines` ainda aceita 'comida' e 'produtos' (vitrines antigas continuam funcionando),
// mas por enquanto o Vitrimove é só para serviços com agendamento: o assistente cria apenas 'servicos'.
export const VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const
export type VitrineType = (typeof VITRINE_TYPES)[number]

export const WIZARD_VITRINE_TYPES = ['servicos'] as const satisfies readonly VitrineType[]

export const VITRINE_TYPE_LABEL: Record<VitrineType, string> = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  comida: 'Comida',
}

export const DEFAULT_BUTTON_TEXT: Record<VitrineType, string> = {
  produtos: 'Adicionar à sacola',
  servicos: 'Quero esse serviço',
  comida: 'Pedir',
}

export const SAMPLE_CATEGORIES: Record<VitrineType, readonly string[]> = {
  produtos: ['Destaques', 'Novidades'],
  servicos: ['Serviços', 'Pacotes'],
  comida: ['Lanches', 'Bebidas'],
}

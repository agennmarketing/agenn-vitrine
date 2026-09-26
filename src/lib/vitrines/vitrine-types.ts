// A tabela `vitrines` também aceita 'comida' (vitrines antigas continuam funcionando), mas o
// assistente cria só os dois tipos do produto de hoje: serviços com agendamento e produtos.
export const VITRINE_TYPES = ['produtos', 'servicos', 'comida'] as const
export type VitrineType = (typeof VITRINE_TYPES)[number]

export const WIZARD_VITRINE_TYPES = ['servicos', 'produtos'] as const satisfies readonly VitrineType[]

// Os dois tipos, como o assistente os apresenta.
export const WIZARD_TYPE_COPY = {
  servicos: {
    title: 'Serviços e Agendamentos',
    description: 'Para profissionais e empresas que trabalham com serviços e horários.',
  },
  produtos: {
    title: 'Produtos',
    description: 'Para lojas e negócios que vendem produtos físicos.',
  },
} as const satisfies Record<(typeof WIZARD_VITRINE_TYPES)[number], { title: string; description: string }>

export const VITRINE_TYPE_LABEL: Record<VitrineType, string> = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  comida: 'Comida',
}

export const DEFAULT_BUTTON_TEXT: Record<VitrineType, string> = {
  produtos: 'Adicionar à sacola',
  servicos: 'Agendar horário',
  comida: 'Pedir',
}

export const SAMPLE_CATEGORIES: Record<VitrineType, readonly string[]> = {
  produtos: ['Destaques', 'Novidades'],
  servicos: ['Serviços', 'Pacotes'],
  comida: ['Lanches', 'Bebidas'],
}

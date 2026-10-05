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

/*
 * Vitrine de produtos: produtos próprios (sacola e pedido no WhatsApp) ou afiliado (cada
 * produto leva direto ao link de afiliado, sem sacola e sem WhatsApp). Escolhido no
 * assistente e fixo depois. No banco, nulo numa vitrine de produtos vale como 'proprios'.
 */
export const PRODUCT_MODES = ['proprios', 'afiliado'] as const
export type ProductMode = (typeof PRODUCT_MODES)[number]

export const PRODUCT_MODE_COPY = {
  proprios: {
    title: 'Produtos próprios',
    description: 'O cliente monta a sacola e o pedido chega no seu WhatsApp.',
  },
  afiliado: {
    title: 'Sou afiliado',
    description: 'Cada produto leva direto ao seu link de afiliado. Sem sacola e sem WhatsApp.',
  },
} as const satisfies Record<ProductMode, { title: string; description: string }>

export const AFFILIATE_BUTTON_TEXT = 'Comprar agora'

export function isAffiliateVitrine(vitrine: { type: string; product_mode?: string | null }): boolean {
  return vitrine.type === 'produtos' && vitrine.product_mode === 'afiliado'
}

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

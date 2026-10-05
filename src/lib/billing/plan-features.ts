import { isAffiliateVitrine } from '@/lib/vitrines/vitrine-types'

/*
 * O que o Essencial inclui, contado do jeito do negócio da pessoa: quem vende produtos
 * (ou é afiliado) nem ouve falar de agenda, e quem atende com hora marcada não vê sacola.
 */
const COMMON_START = ['1 vitrine']
const COMMON_END = ['Personalização', 'Link e QR Code para divulgar']

export function planFeatures(vitrine: { type: string; product_mode?: string | null } | null): string[] {
  if (vitrine?.type === 'servicos') {
    return [...COMMON_START, 'Serviços ilimitados', 'Fotos', 'Agenda online', 'Agendamentos', ...COMMON_END]
  }
  if (vitrine && isAffiliateVitrine(vitrine)) {
    return [...COMMON_START, 'Produtos ilimitados', 'Fotos', 'Botão "Comprar agora" com o seu link de afiliado', ...COMMON_END]
  }
  if (vitrine?.type === 'produtos') {
    return [...COMMON_START, 'Produtos ilimitados', 'Fotos', 'Pedidos pelo WhatsApp', 'Sacola de compras', ...COMMON_END]
  }
  // Ainda sem vitrine: só o que vale para todo mundo.
  return [...COMMON_START, 'Itens ilimitados', 'Fotos', ...COMMON_END]
}

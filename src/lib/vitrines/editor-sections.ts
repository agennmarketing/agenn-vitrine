import { LayoutGrid, MessageCircle, Palette, Settings, Share2, ShoppingBag, UsersRound, Wrench } from 'lucide-react'
import type { VitrineType } from './vitrine-types'

/*
 * Seções do editor de cada tipo de vitrine (as abas do editor).
 * Serviços: a lista se chama "Serviços", o WhatsApp dá lugar aos Profissionais e não há sacola
 * (a Agenda fica na barra lateral). Produtos (e as antigas de comida) têm sacola e WhatsApp.
 */
export function editorSections(type: VitrineType) {
  const servicos = type === 'servicos'
  return [
    servicos
      ? { slug: 'itens', label: 'Serviços', Icon: Wrench }
      : { slug: 'itens', label: type === 'produtos' ? 'Produtos' : 'Itens', Icon: LayoutGrid },
    { slug: 'aparencia', label: 'Aparência', Icon: Palette },
    servicos
      ? { slug: 'profissionais', label: 'Profissionais', Icon: UsersRound }
      : { slug: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
    ...(servicos ? [] : [{ slug: 'mensagens', label: 'Sacola e mensagens', Icon: ShoppingBag }]),
    { slug: 'configuracoes', label: 'Configurações', Icon: Settings },
    { slug: 'compartilhar', label: 'Compartilhar', Icon: Share2 },
  ]
}

import { LayoutGrid, MessageCircle, Palette, Settings, Share2, ShoppingBag, Wrench } from 'lucide-react'
import type { VitrineType } from './vitrine-types'

/*
 * Seções do editor de cada tipo de vitrine (as abas do editor).
 * Serviços: a lista se chama "Serviços" e não há sacola. Produtos (e as antigas de comida) têm as duas.
 */
export function editorSections(type: VitrineType) {
  const servicos = type === 'servicos'
  return [
    servicos ? { slug: 'itens', label: 'Serviços', Icon: Wrench } : { slug: 'itens', label: 'Itens', Icon: LayoutGrid },
    { slug: 'aparencia', label: 'Aparência', Icon: Palette },
    { slug: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
    ...(servicos ? [] : [{ slug: 'mensagens', label: 'Sacola e mensagens', Icon: ShoppingBag }]),
    { slug: 'configuracoes', label: 'Configurações', Icon: Settings },
    { slug: 'compartilhar', label: 'Compartilhar', Icon: Share2 },
  ]
}

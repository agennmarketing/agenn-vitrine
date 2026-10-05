import { redirect } from 'next/navigation'
import { listMyVitrines } from '@/features/vitrines/queries'

export const metadata = { title: 'Minha vitrine' }

// Uma vitrine por conta: quem já tem vai direto para o editor; quem não tem cai direto no assistente.
export default async function PainelHome() {
  const [vitrine] = await listMyVitrines()
  redirect(vitrine ? `/painel/vitrines/${vitrine.id}/itens` : '/painel/vitrines/nova')
}

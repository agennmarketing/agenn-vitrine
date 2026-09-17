import { getMyVitrine } from '@/features/vitrines/queries'
import { MessagesForm } from './messages-form'

export const metadata = { title: 'Sacola e mensagens' }

export default async function MensagensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  return <MessagesForm vitrineId={id} defaultButtonText={vitrine.default_button_text} />
}

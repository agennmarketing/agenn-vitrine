import { ItemDialogs } from '../item-dialog-route'

export const metadata = { title: 'Novo item' }

// Link direto (ou recarregar a página): a lista por trás e o popup por cima.
export default async function NovoItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ItemDialogs id={id} />
}

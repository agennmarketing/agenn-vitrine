import { ItemDialogs } from '../item-dialog-route'

export const metadata = { title: 'Editar item' }

// Link direto (ou recarregar a página): a lista por trás e o popup por cima.
export default async function EditarItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  return <ItemDialogs id={id} itemId={itemId} />
}

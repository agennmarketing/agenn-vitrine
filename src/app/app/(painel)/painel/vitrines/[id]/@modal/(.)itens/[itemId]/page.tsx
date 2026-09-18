import { EditItemDialog } from '../../../itens/item-dialogs'

// Aberto pela lista: o popup entra por cima e a lista continua por trás.
export default async function EditarItemModal({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  return <EditItemDialog id={id} itemId={itemId} intercepted />
}

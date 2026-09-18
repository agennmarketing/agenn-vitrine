import { NewItemDialog } from '../../../itens/item-dialogs'

// Aberto pela lista: o popup entra por cima e a lista continua por trás.
export default async function NovoItemModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NewItemDialog id={id} intercepted />
}

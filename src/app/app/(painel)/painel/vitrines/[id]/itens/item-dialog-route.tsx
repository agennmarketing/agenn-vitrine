import { EditItemDialog, NewItemDialog } from './item-dialogs'
import { ItemsView } from './items-view'

// Página inteira de novo item / edição: a lista de itens com o popup aberto por cima.
export function ItemDialogs({ id, itemId }: { id: string; itemId?: string }) {
  return (
    <>
      <ItemsView id={id} />
      {itemId ? <EditItemDialog id={id} itemId={itemId} /> : <NewItemDialog id={id} />}
    </>
  )
}

import { getItemForEdit, getItemFormOptions } from '@/features/items/queries'
import { getMyVitrine, getVideoLimits } from '@/features/vitrines/queries'
import { ItemDialog } from './item-dialog'
import { ItemForm, NoCategoryStep } from './item-form'

// Popup de novo item. Sem categoria, o popup explica o que falta em vez de abrir o formulário.
export async function NewItemDialog({ id, intercepted = false }: { id: string; intercepted?: boolean }) {
  const [options, vitrine, videoLimits] = await Promise.all([getItemFormOptions(id), getMyVitrine(id), getVideoLimits()])
  return (
    <ItemDialog vitrineId={id} label="Novo item" intercepted={intercepted}>
      {options.categories.length === 0 ? (
        <NoCategoryStep />
      ) : (
        <ItemForm
          vitrineId={id}
          vitrineType={options.vitrine.type}
          serviceSegment={vitrine.service_segment}
          defaultButtonText={vitrine.default_button_text}
          categories={options.categories}
          contacts={options.contacts}
          nextCode={options.nextCode}
          videoLimits={videoLimits}
        />
      )}
    </ItemDialog>
  )
}

// Popup de edição: os mesmos passos, com "Salvar item" disponível em qualquer um deles.
export async function EditItemDialog({ id, itemId, intercepted = false }: { id: string; itemId: string; intercepted?: boolean }) {
  const [options, vitrine, item, videoLimits] = await Promise.all([
    getItemFormOptions(id),
    getMyVitrine(id),
    getItemForEdit(id, itemId),
    getVideoLimits(),
  ])
  return (
    <ItemDialog vitrineId={id} label="Editar item" intercepted={intercepted}>
      <ItemForm
        key={item.updated_at}
        vitrineId={id}
        vitrineType={options.vitrine.type}
        serviceSegment={vitrine.service_segment}
        defaultButtonText={vitrine.default_button_text}
        categories={options.categories}
        contacts={options.contacts}
        nextCode={options.nextCode}
        videoLimits={videoLimits}
        item={item}
      />
    </ItemDialog>
  )
}

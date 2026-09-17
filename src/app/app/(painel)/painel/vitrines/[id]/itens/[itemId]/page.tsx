import { getItemForEdit, getItemFormOptions } from '@/features/items/queries'
import { getMyVitrine, getVideoLimits } from '@/features/vitrines/queries'
import { ItemForm } from '../item-form'

export const metadata = { title: 'Editar item' }

export default async function EditarItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const [options, vitrine, item, videoLimits] = await Promise.all([
    getItemFormOptions(id),
    getMyVitrine(id),
    getItemForEdit(id, itemId),
    getVideoLimits(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Editar item</h2>
      <ItemForm
        key={item.updated_at}
        vitrineId={id}
        vitrineType={options.vitrine.type}
        defaultButtonText={vitrine.default_button_text}
        categories={options.categories}
        contacts={options.contacts}
        nextCode={options.nextCode}
        videoLimits={videoLimits}
        item={item}
      />
    </div>
  )
}

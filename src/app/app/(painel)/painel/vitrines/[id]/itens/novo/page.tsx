import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { getItemFormOptions } from '@/features/items/queries'
import { getMyVitrine, getVideoLimits } from '@/features/vitrines/queries'
import { ItemForm } from '../item-form'

export const metadata = { title: 'Novo item' }

export default async function NovoItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [options, vitrine, videoLimits] = await Promise.all([getItemFormOptions(id), getMyVitrine(id), getVideoLimits()])

  if (options.categories.length === 0) {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <p>Crie uma categoria antes de cadastrar itens.</p>
        <Link href={`/painel/vitrines/${id}/itens`} className="underline">
          Voltar para os itens
        </Link>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Novo item</h2>
      <ItemForm
        vitrineId={id}
        vitrineType={options.vitrine.type}
        defaultButtonText={vitrine.default_button_text}
        categories={options.categories}
        contacts={options.contacts}
        nextCode={options.nextCode}
        videoLimits={videoLimits}
      />
    </div>
  )
}

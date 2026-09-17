import { Card } from '@/components/ui/card'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'

export const metadata = { title: 'Itens' }

// Versão simples: a lista completa de itens chega no Bloco 6.
export default async function ItensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('vitrine_id', id)
    .order('position')

  return (
    <div className="flex flex-col gap-4">
      {(categories ?? []).map((category) => (
        <Card key={category.id} className="flex flex-col gap-2 p-5">
          <h2 className="text-lg font-medium">{category.name}</h2>
          <p className="text-sm text-ink-muted">Nenhum item nesta categoria.</p>
        </Card>
      ))}
    </div>
  )
}

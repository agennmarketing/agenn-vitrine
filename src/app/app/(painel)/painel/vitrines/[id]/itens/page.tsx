import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { CategoryManager } from './category-manager'
import { ItemList } from './item-list'

export const metadata = { title: 'Itens' }

export default async function ItensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ salvo?: string }>
}) {
  const [{ id }, { salvo }] = await Promise.all([params, searchParams])
  await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('vitrine_id', id).order('position').order('created_at'),
    supabase
      .from('items')
      .select('id, name, code, category_id, price_type, price_cents, promo_price_cents, sold_out, item_variations(price_cents, promo_price_cents)')
      .eq('vitrine_id', id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
  ])

  return (
    <div className="flex flex-col gap-4">
      {salvo === '1' ? <FormMessage success="Item salvo." /> : null}
      <div className="flex justify-end">
        <Link href={`/painel/vitrines/${id}/itens/novo`} className={buttonClasses('primary')}>
          Novo item
        </Link>
      </div>
      <CategoryManager vitrineId={id} categories={categories ?? []} />
      <ItemList
        vitrineId={id}
        categories={categories ?? []}
        items={(items ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          categoryId: item.category_id,
          priceType: item.price_type as 'fixed' | 'from' | 'on_request',
          priceCents: item.price_cents,
          promoPriceCents: item.promo_price_cents,
          soldOut: item.sold_out,
          variations: item.item_variations.map((v) => ({ priceCents: v.price_cents, promoPriceCents: v.promo_price_cents })),
        }))}
      />
    </div>
  )
}

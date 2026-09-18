import { Celebration } from '@/components/ui/celebration'
import { ClearSearchParams } from '@/components/ui/clear-search-params'
import { FormMessage } from '@/components/ui/form-message'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'
import { CategoryManager } from './category-manager'
import { ItemList } from './item-list'

export const metadata = { title: 'Itens' }

export default async function ItensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ salvo?: string; criada?: string }>
}) {
  const [{ id }, { salvo, criada }] = await Promise.all([params, searchParams])
  await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('vitrine_id', id).order('position').order('created_at'),
    supabase
      .from('items')
      .select(
        'id, name, code, category_id, price_type, price_cents, promo_price_cents, sold_out, item_variations(price_cents, promo_price_cents), media(role, storage_paths)',
      )
      .eq('vitrine_id', id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
  ])

  return (
    <div className="flex flex-col gap-5">
      {criada === '1' || salvo === '1' ? <ClearSearchParams keys={['criada', 'salvo']} /> : null}
      {criada === '1' ? (
        <Celebration title="Vitrine criada!">O próximo passo é cadastrar o primeiro item: foto, nome e preço.</Celebration>
      ) : null}
      {salvo === '1' ? <FormMessage success="Item salvo." /> : null}
      {salvo === '1' && (items ?? []).length === 1 ? (
        <Celebration title="Primeiro item no ar!" announce={false}>Ele já aparece na sua vitrine. Que tal mais alguns?</Celebration>
      ) : null}
      <ItemList
        vitrineId={id}
        categories={categories ?? []}
        categoryManager={<CategoryManager vitrineId={id} categories={categories ?? []} />}
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
          // Miniatura da capa (a menor largura); sem capa, a lista mostra um marcador.
          thumbUrl:
            imageSources((item.media ?? []).find((m) => m.role === 'cover')?.storage_paths, env.NEXT_PUBLIC_MEDIA_BASE_URL)
              ?.small ?? null,
        }))}
      />
    </div>
  )
}

import { Celebration } from '@/components/ui/celebration'
import { ClearSearchParams } from '@/components/ui/clear-search-params'
import { FlashMessage } from '@/components/ui/flash-message'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'
import { CategoryManager } from './category-manager'
import { ItemList } from './item-list'

// Lista de itens da vitrine. Também fica por trás do popup de novo item e de edição.
export async function ItemsView({ id, salvo, criada }: { id: string; salvo?: string; criada?: string }) {
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
      {criada === '1' || salvo ? <ClearSearchParams keys={['criada', 'salvo']} /> : null}
      {criada === '1' ? (
        <Celebration title="Vitrine criada!">O próximo passo é cadastrar o primeiro item: foto, nome e preço.</Celebration>
      ) : null}
      {/* No primeiro item criado, só a comemoração (sem o "Item salvo." junto). */}
      {salvo === 'novo' && (items ?? []).length === 1 ? (
        <Celebration title="Primeiro item no ar!">Ele já aparece na sua vitrine. Que tal mais alguns?</Celebration>
      ) : salvo === '1' || salvo === 'novo' ? (
        <FlashMessage message="Item salvo." />
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

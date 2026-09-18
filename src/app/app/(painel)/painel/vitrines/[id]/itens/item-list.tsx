'use client'

import { GripVertical, ImageIcon, PackageOpen, Plus, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { DragHandle, SortableItem, SortableList } from '@/components/ui/sortable-list'
import { Switch } from '@/components/ui/switch'
import {
  deleteItemAction,
  duplicateItemAction,
  moveItemAction,
  reorderItemsAction,
  toggleSoldOutAction,
} from '@/features/items/actions'
import type { FormState } from '@/lib/forms/form-state'
import { formatPriceLabel, priceLabel, type PriceType } from '@/lib/pricing/price'
import { ItemActionsMenu } from './item-actions-menu'

type ListItem = {
  id: string
  name: string
  code: string
  categoryId: string | null
  priceType: PriceType
  priceCents: number | null
  promoPriceCents: number | null
  soldOut: boolean
  variations: { priceCents: number; promoPriceCents: number | null }[]
  thumbUrl: string | null
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function ItemList({
  vitrineId,
  categories,
  categoryManager,
  items,
}: {
  vitrineId: string
  categories: { id: string; name: string }[]
  categoryManager: ReactNode
  items: ListItem[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  // Cópia local para a ordem mudar na hora ao soltar; volta a seguir o servidor quando ele manda itens novos.
  const [serverItems, setServerItems] = useState(items)
  const [localItems, setLocalItems] = useState(items)
  if (serverItems !== items) {
    setServerItems(items)
    setLocalItems(items)
  }
  const newItemHref = `/painel/vitrines/${vitrineId}/itens/novo`

  function run(itemId: string, action: () => Promise<FormState>) {
    setBusyId(itemId)
    startTransition(async () => {
      const result = await action()
      setMessage(result)
      setBusyId(null)
      if (!result.error) router.refresh()
    })
  }

  // Arrastar só dentro da mesma categoria: os itens dela ocupam as mesmas vagas na lista geral, na nova ordem.
  function reorder(categoryId: string, orderedIds: string[]) {
    const previous = localItems
    const byId = new Map(previous.map((item) => [item.id, item]))
    const queue = orderedIds.map((id) => byId.get(id)!)
    setLocalItems(previous.map((item) => (item.categoryId === categoryId ? queue.shift()! : item)))
    setMessage({})
    startTransition(async () => {
      const result = await reorderItemsAction(vitrineId, orderedIds)
      setMessage(result)
      if (result.error) setLocalItems(previous)
      else router.refresh()
    })
  }

  const search = fold(query.trim())
  const visible = search ? localItems.filter((item) => fold(item.name).includes(search) || fold(item.code).includes(search)) : localItems
  const empty = items.length === 0

  return (
    // Folga embaixo no celular para o botão flutuante não cobrir o interruptor do último item.
    <div className={`flex flex-col gap-5 ${empty ? '' : 'pb-16 lg:pb-0'}`}>
      {empty ? null : (
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
              strokeWidth={2.75}
            />
            <Input
              type="search"
              aria-label="Buscar itens"
              placeholder="Buscar por nome ou código"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={3} />
              </button>
            ) : null}
          </div>
          {/* Um só link "Novo item": no celular flutua acima da barra inferior; no computador fica ao lado da busca. */}
          <Link
            href={newItemHref}
            className={buttonClasses(
              'primary',
              'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 lg:static lg:shrink-0',
              'lg',
            )}
          >
            <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
            Novo item
          </Link>
        </div>
      )}

      {categoryManager}

      <div aria-live="polite">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {empty ? (
        <section className="flex flex-col items-center gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-card bg-go-soft text-go-strong shadow-[0_4px_0_var(--color-go)]"
          >
            <PackageOpen className="size-8" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-black tracking-[-0.02em]">Sua vitrine está esperando o primeiro item</h2>
            <p className="max-w-sm font-semibold text-ink-muted">
              {categories.length === 0
                ? 'Primeiro crie uma categoria logo acima (por exemplo, Lanches). Depois é só colocar foto, nome e preço.'
                : 'Coloque foto, nome e preço. Em um minuto ele aparece para os clientes.'}
            </p>
          </div>
          <Link href={newItemHref} className={buttonClasses('primary', 'w-full max-w-xs', 'lg')}>
            <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
            Novo item
          </Link>
        </section>
      ) : null}
      {/* Sem itens, as categorias continuam na tela (vazias) abaixo do convite. */}
      {search && visible.length === 0 && !empty ? (
        <p className="rounded-card border-2 border-dashed border-line-strong bg-surface px-5 py-8 text-center font-bold text-ink-muted">
          Nenhum item encontrado para “{query.trim()}”.
        </p>
      ) : (
        categories.map((category) => {
          const categoryItems = visible.filter((item) => item.categoryId === category.id)
          // Na busca, categorias sem resultado saem da tela.
          if (search && categoryItems.length === 0) return null
          return (
            <section key={category.id} className="flex flex-col gap-2.5" aria-labelledby={`categoria-${category.id}`}>
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 id={`categoria-${category.id}`} className="min-w-0 truncate text-lg font-black tracking-[-0.02em]">
                  {category.name}
                </h2>
                <span className="shrink-0 text-sm font-bold text-ink-muted numeric">
                  {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              {categoryItems.length === 0 ? (
                <p className="rounded-card border-2 border-dashed border-line px-4 py-5 text-sm font-semibold text-ink-muted">
                  Nenhum item nesta categoria.
                </p>
              ) : (
                <SortableList
                  entries={categoryItems.map((item) => ({ id: item.id, label: item.name }))}
                  onReorder={(orderedIds) => reorder(category.id, orderedIds)}
                  disabled={pending}
                  handleDisabled={search !== ''}
                  renderOverlay={(id) => <ItemOverlay item={categoryItems.find((item) => item.id === id)} />}
                >
                  <ul className="flex flex-col rounded-card border-2 border-line bg-surface">
                    {categoryItems.map((item, index) => (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        className={`flex items-center gap-1 py-2.5 pl-0.5 pr-1.5 sm:gap-2 sm:pl-1 ${index > 0 ? 'border-t-2 border-line' : ''} ${
                          busyId === item.id ? 'opacity-60' : ''
                        }`}
                      >
                        <DragHandle label={`Reordenar ${item.name}`} className="h-11 w-9 rounded-control sm:w-11 sm:rounded-full" />
                        <Link
                          href={`/painel/vitrines/${vitrineId}/itens/${item.id}`}
                          aria-label={`Editar ${item.name}`}
                          className="group flex min-w-0 flex-1 items-center gap-3 rounded-control p-0.5"
                        >
                          <span
                            className={`relative flex h-[4.375rem] w-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-subtle text-ink-muted ${
                              item.soldOut ? 'grayscale' : ''
                            }`}
                          >
                            {item.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                            ) : (
                              <ImageIcon aria-hidden="true" className="size-6" strokeWidth={2.25} />
                            )}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="line-clamp-2 font-extrabold leading-snug text-ink group-hover:text-go-strong">
                              {item.name}
                            </span>
                            <span className="text-xs font-bold text-ink-muted">cód. {item.code}</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className={`font-black numeric ${item.soldOut ? 'text-ink-muted' : 'text-ink'}`}>
                                {formatPriceLabel(priceLabel(item, item.variations))}
                              </span>
                              {item.soldOut ? <Badge tone="danger">Esgotado</Badge> : null}
                            </span>
                          </span>
                        </Link>
                        <Switch
                          checked={!item.soldOut}
                          aria-label={`${item.name} disponível`}
                          title={item.soldOut ? 'Esgotado. Toque para voltar a vender.' : 'Disponível. Toque para marcar como esgotado.'}
                          disabled={pending}
                          onClick={() => run(item.id, () => toggleSoldOutAction(vitrineId, item.id))}
                        />
                        <ItemActionsMenu
                          itemName={item.name}
                          disabled={pending}
                          canMoveUp={!pending && search === '' && index > 0}
                          canMoveDown={!pending && search === '' && index < categoryItems.length - 1}
                          onDuplicate={() => run(item.id, () => duplicateItemAction(vitrineId, item.id))}
                          onMoveUp={() => run(item.id, () => moveItemAction(vitrineId, item.id, 'up'))}
                          onMoveDown={() => run(item.id, () => moveItemAction(vitrineId, item.id, 'down'))}
                          onDelete={() => {
                            if (window.confirm('Excluir este item?')) run(item.id, () => deleteItemAction(vitrineId, item.id))
                          }}
                        />
                      </SortableItem>
                    ))}
                  </ul>
                </SortableList>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

// Linha levantada durante o arrasto: miniatura e nome, como na lista.
function ItemOverlay({ item }: { item?: ListItem }) {
  if (!item) return null
  return (
    <>
      <span className="flex h-full w-9 shrink-0 items-center justify-center text-go-strong sm:w-11">
        <GripVertical aria-hidden="true" className="size-5" strokeWidth={2.5} />
      </span>
      <span className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[0.625rem] bg-subtle text-ink-muted">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon aria-hidden="true" className="size-5" strokeWidth={2.25} />
        )}
      </span>
      <span className="min-w-0 truncate font-extrabold text-ink">{item.name}</span>
    </>
  )
}

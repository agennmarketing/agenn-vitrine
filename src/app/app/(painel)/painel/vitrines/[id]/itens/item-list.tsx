'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteItemAction, duplicateItemAction, moveItemAction, toggleSoldOutAction } from '@/features/items/actions'
import type { FormState } from '@/lib/forms/form-state'
import { formatPriceLabel, priceLabel, type PriceType } from '@/lib/pricing/price'

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
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function ItemList({
  vitrineId,
  categories,
  items,
}: {
  vitrineId: string
  categories: { id: string; name: string }[]
  items: ListItem[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action()
      setMessage(result)
      if (!result.error) router.refresh()
    })
  }

  const search = fold(query.trim())
  const visible = search ? items.filter((item) => fold(item.name).includes(search) || fold(item.code).includes(search)) : items

  return (
    <div className="flex flex-col gap-4">
      <Input aria-label="Buscar itens" placeholder="Buscar itens" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div aria-live="polite">
        <FormMessage error={message.error} success={message.success} />
      </div>
      {categories.map((category) => {
        const categoryItems = visible.filter((item) => item.categoryId === category.id)
        return (
          <Card key={category.id} className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-medium">{category.name}</h2>
            {categoryItems.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum item nesta categoria.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {categoryItems.map((item, index) => (
                  <li key={item.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-ink-muted">cód. {item.code}</span>
                      {item.soldOut ? (
                        <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium">Esgotado</span>
                      ) : null}
                    </div>
                    <span className="text-sm">{formatPriceLabel(priceLabel(item, item.variations))}</span>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/painel/vitrines/${vitrineId}/itens/${item.id}`} className={buttonClasses('secondary')}>
                        Editar
                      </Link>
                      <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateItemAction(vitrineId, item.id))}>
                        Duplicar
                      </Button>
                      <Button variant="ghost" disabled={pending} onClick={() => run(() => toggleSoldOutAction(vitrineId, item.id))}>
                        {item.soldOut ? 'Marcar como disponível' : 'Marcar como esgotado'}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending || search !== '' || index === 0}
                        onClick={() => run(() => moveItemAction(vitrineId, item.id, 'up'))}
                      >
                        Subir
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending || search !== '' || index === categoryItems.length - 1}
                        onClick={() => run(() => moveItemAction(vitrineId, item.id, 'down'))}
                      >
                        Descer
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm('Excluir este item?')) run(() => deleteItemAction(vitrineId, item.id))
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}

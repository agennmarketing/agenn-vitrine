'use client'

import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { DragHandle, SortableItem, SortableList } from '@/components/ui/sortable-list'
import {
  addCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
  reorderCategoriesAction,
} from '@/features/categories/actions'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

type Category = { id: string; name: string }

const chipBase =
  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-extrabold transition-colors duration-150 ease-out-quint'

/*
 * Categorias como pílulas: tocar numa abre a edição logo abaixo (renomear, mover, excluir);
 * a pílula "Nova categoria" abre o campo de criar. Sem categorias, o campo de criar já vem aberto.
 * Cada pílula tem uma alça para arrastar e mudar a ordem (Subir/Descer continuam no painel de edição).
 */
export function CategoryManager({ vitrineId, categories: serverCategories }: { vitrineId: string; categories: Category[] }) {
  const router = useRouter()
  // Cópia local para a ordem mudar na hora ao soltar; volta a seguir o servidor quando ele manda a lista nova.
  const [lastServer, setLastServer] = useState(serverCategories)
  const [categories, setCategories] = useState(serverCategories)
  if (lastServer !== serverCategories) {
    setLastServer(serverCategories)
    setCategories(serverCategories)
  }
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(categories.length === 0)
  const editingIndex = categories.findIndex((c) => c.id === editingId)
  const editing = editingIndex >= 0 ? categories[editingIndex] : null
  const panelOpen = !!editing || adding || categories.length === 0

  function reorder(orderedIds: string[]) {
    const previous = categories
    const byId = new Map(previous.map((category) => [category.id, category]))
    setCategories(orderedIds.map((id) => byId.get(id)!))
    setMessage({})
    startTransition(async () => {
      const result = await reorderCategoriesAction(vitrineId, orderedIds)
      setMessage(result)
      if (result.error) setCategories(previous)
      else router.refresh()
    })
  }

  function run(action: () => Promise<FormState>, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      setMessage(result)
      if (!result.error) {
        after?.()
        router.refresh()
      }
    })
  }

  return (
    <section aria-labelledby="categorias-titulo" className="flex flex-col gap-3">
      <h2 id="categorias-titulo" className="px-1 text-sm font-extrabold text-ink-muted">
        Categorias
      </h2>
      <div className="-mx-4 lg:mx-0">
        <SortableList
          layout="grid"
          entries={categories.map((category) => ({ id: category.id, label: category.name }))}
          onReorder={reorder}
          disabled={pending}
        >
          <ul className="flex gap-2 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => {
              const active = category.id === editingId
              return (
                // A pílula junta a alça de arrastar (à esquerda) e o botão de editar.
                <SortableItem
                  key={category.id}
                  id={category.id}
                  placeholderClassName="rounded-full"
                  className={`inline-flex h-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150 ease-out-quint ${
                    active ? 'border-go-strong bg-surface text-go-strong' : 'border-line-strong bg-surface text-ink hover:bg-canvas'
                  }`}
                >
                  <DragHandle
                    label={`Reordenar categoria ${category.name}`}
                    tone="default"
                    className="h-10 w-8 rounded-l-full pl-1"
                  />
                  <button
                    type="button"
                    aria-expanded={active}
                    aria-controls={active ? 'categoria-edicao' : undefined}
                    aria-label={`Editar categoria ${category.name}`}
                    onClick={() => {
                      setAdding(false)
                      setEditingId(active ? null : category.id)
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-r-full pl-1 pr-3.5 text-sm font-extrabold"
                  >
                    <span className="max-w-[12rem] truncate">{category.name}</span>
                    <Pencil aria-hidden="true" className={`size-3.5 ${active ? 'text-go-strong' : 'text-ink-muted'}`} strokeWidth={2.75} />
                  </button>
                </SortableItem>
              )
            })}
            <li>
              <button
                type="button"
                aria-expanded={adding}
                aria-controls={adding ? 'categoria-edicao' : undefined}
                onClick={() => {
                  setEditingId(null)
                  setAdding((open) => !open || categories.length === 0)
                }}
                className={`${chipBase} border-dashed ${
                  adding ? 'border-go-strong bg-go-soft text-go-strong' : 'border-line-strong text-go-strong hover:bg-go-soft'
                }`}
              >
                <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
                Nova categoria
              </button>
            </li>
          </ul>
        </SortableList>
      </div>

      <div aria-live="polite" className="empty:absolute">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {panelOpen ? (
        <div id="categoria-edicao" className="flex animate-rise flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
          {editing ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate font-black tracking-[-0.01em]">Editar “{editing.name}”</h3>
                <button
                  type="button"
                  aria-label="Fechar edição da categoria"
                  onClick={() => setEditingId(null)}
                  className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-ink"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={3} />
                </button>
              </div>
              <RenameForm key={editing.id} vitrineId={vitrineId} category={editing} onDone={() => router.refresh()} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending || editingIndex === 0}
                  onClick={() => run(() => moveCategoryAction(vitrineId, editing.id, 'up'))}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2.75} />
                  Subir
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending || editingIndex === categories.length - 1}
                  onClick={() => run(() => moveCategoryAction(vitrineId, editing.id, 'down'))}
                >
                  Descer
                  <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  className="ml-auto text-danger hover:bg-danger-soft"
                  onClick={() => run(() => deleteCategoryAction(vitrineId, editing.id), () => setEditingId(null))}
                >
                  <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                  Excluir categoria
                </Button>
              </div>
            </>
          ) : (
            <NewCategoryForm vitrineId={vitrineId} onAdded={() => router.refresh()} />
          )}
        </div>
      ) : null}
    </section>
  )
}

function RenameForm({ vitrineId, category, onDone }: { vitrineId: string; category: Category; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await renameCategoryAction(vitrineId, category.id, prev, formData)
    if (result.success) onDone()
    return result
  }, { values: { name: category.name } })
  const error = state.fieldErrors?.name
  return (
    <form action={formAction} noValidate className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            aria-label={`Nome da categoria ${category.name}`}
            name="name"
            defaultValue={state.values?.name ?? category.name}
            maxLength={40}
            invalid={!!error}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          Renomear
        </Button>
      </div>
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
      <FormMessage success={state.success} />
    </form>
  )
}

function NewCategoryForm({ vitrineId, onAdded }: { vitrineId: string; onAdded: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addCategoryAction(vitrineId, prev, formData)
    if (result.success) onAdded()
    return result
  }, initialFormState)
  const error = state.fieldErrors?.name
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <h3 className="font-black tracking-[-0.01em]">Nova categoria</h3>
      <Field label="Nome da categoria" htmlFor="new-category" error={error}>
        <div className="flex items-start gap-2">
          <Input
            id="new-category"
            name="name"
            maxLength={40}
            placeholder="Ex.: Lanches, Bebidas"
            invalid={!!error}
            className="flex-1"
          />
          <Button type="submit" disabled={pending} className="shrink-0">
            <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
            <span className="max-sm:sr-only">Adicionar categoria</span>
          </Button>
        </div>
      </Field>
      <FormMessage error={state.error} success={state.success} />
    </form>
  )
}

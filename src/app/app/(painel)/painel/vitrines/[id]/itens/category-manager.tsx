'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import {
  addCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from '@/features/categories/actions'
import { initialFormState, type FormState } from '@/lib/forms/form-state'

type Category = { id: string; name: string }

export function CategoryManager({ vitrineId, categories }: { vitrineId: string; categories: Category[] }) {
  const router = useRouter()
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action()
      setMessage(result)
      if (!result.error) router.refresh()
    })
  }

  return (
    <Card className="p-5">
      <details open={categories.length === 0}>
        <summary className="cursor-pointer font-medium">Categorias</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div aria-live="polite">
            <FormMessage error={message.error} success={message.success} />
          </div>
          <ul className="flex flex-col gap-3">
            {categories.map((category, index) => (
              <li key={category.id} className="flex flex-col gap-2 rounded-control border border-line p-3">
                <RenameForm vitrineId={vitrineId} category={category} onDone={() => router.refresh()} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    disabled={pending || index === 0}
                    onClick={() => run(() => moveCategoryAction(vitrineId, category.id, 'up'))}
                  >
                    Subir
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending || index === categories.length - 1}
                    onClick={() => run(() => moveCategoryAction(vitrineId, category.id, 'down'))}
                  >
                    Descer
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => deleteCategoryAction(vitrineId, category.id))}
                  >
                    Excluir categoria
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <NewCategoryForm vitrineId={vitrineId} onAdded={() => router.refresh()} />
        </div>
      </details>
    </Card>
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
    <form action={formAction} noValidate className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <Input
          aria-label={`Nome da categoria ${category.name}`}
          name="name"
          defaultValue={state.values?.name ?? category.name}
          maxLength={40}
          invalid={!!error}
        />
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Renomear
      </Button>
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
      <h3 className="font-medium">Nova categoria</h3>
      <Field label="Nome da categoria" htmlFor="new-category" error={error}>
        <Input id="new-category" name="name" maxLength={40} invalid={!!error} />
      </Field>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} className="self-start">
        Adicionar categoria
      </Button>
    </form>
  )
}

'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { chooseActiveVitrineAction } from '@/features/billing/actions'

export function ActiveVitrineForm({
  vitrines,
  maxVitrines,
}: {
  vitrines: { id: string; name: string; status: string }[]
  maxVitrines: number
}) {
  const [state, formAction, pending] = useActionState(chooseActiveVitrineAction, {})
  const current = vitrines.find((vitrine) => vitrine.status === 'active')?.id ?? vitrines[0]?.id

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Escolha qual vitrine fica ativa</legend>
        <p className="text-sm text-ink-muted">
          Seu plano permite {maxVitrines} {maxVitrines === 1 ? 'vitrine' : 'vitrines'}. As outras ficam congeladas, sem
          perder nada, e voltam ao ar quando você assinar o Pro.
        </p>
        {vitrines.map((vitrine) => (
          <label key={vitrine.id} className="flex items-center gap-3">
            <input type="radio" name="vitrineId" value={vitrine.id} defaultChecked={vitrine.id === current} />
            <span>
              {vitrine.name} · {vitrine.status === 'active' ? 'ativa' : 'congelada'}
            </span>
          </label>
        ))}
      </fieldset>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
        Salvar escolha
      </Button>
    </form>
  )
}

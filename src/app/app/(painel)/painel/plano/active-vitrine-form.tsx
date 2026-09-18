'use client'

import { useActionState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/submit-button'
import { TypeIcon } from '@/components/ui/type-icon'
import { chooseActiveVitrineAction } from '@/features/billing/actions'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

export function ActiveVitrineForm({
  vitrines,
  maxVitrines,
}: {
  vitrines: { id: string; name: string; status: string; type: VitrineType }[]
  maxVitrines: number
}) {
  const [state, formAction, pending] = useActionState(chooseActiveVitrineAction, {})
  const current = vitrines.find((vitrine) => vitrine.status === 'active')?.id ?? vitrines[0]?.id

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="flex flex-col gap-1">
          <span className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">Escolha qual vitrine fica ativa</span>
          <span className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">
            Seu plano permite {maxVitrines} {maxVitrines === 1 ? 'vitrine' : 'vitrines'}. As outras ficam congeladas, sem
            perder nada, e voltam ao ar quando você assinar o Pro.
          </span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {vitrines.map((vitrine) => {
            const active = vitrine.status === 'active'
            return (
              <ChoiceCard
                key={vitrine.id}
                name="vitrineId"
                value={vitrine.id}
                defaultChecked={vitrine.id === current}
                aria-label={`${vitrine.name} · ${active ? 'ativa' : 'congelada'}`}
                icon={<TypeIcon type={vitrine.type} size="sm" />}
                title={vitrine.name}
                description={
                  <Badge tone={active ? 'go' : 'neutral'} className="mt-1">
                    {active ? 'Ativa agora' : 'Congelada'}
                  </Badge>
                }
              />
            )
          })}
        </div>
      </fieldset>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto sm:self-start">
        {pending ? <Spinner /> : null}
        Salvar escolha
      </Button>
    </form>
  )
}

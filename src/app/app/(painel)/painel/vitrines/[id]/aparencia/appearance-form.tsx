'use client'

import { useActionState } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateAppearanceAction } from '@/features/vitrines/actions'
import { initialFormState } from '@/lib/forms/form-state'

type Appearance = {
  theme: 'light' | 'dark'
  showPrices: boolean
  showMedia: boolean
  brandColor: string
  bannerEnabled: boolean
}

type Slot = { id: string; url: string } | null

export function AppearanceForm({
  vitrineId,
  allowBranding,
  logo,
  banner,
  initial,
}: {
  vitrineId: string
  allowBranding: boolean
  logo: Slot
  banner: Slot
  initial: Appearance
}) {
  const [state, formAction, pending] = useActionState(updateAppearanceAction.bind(null, vitrineId), initialFormState)

  return (
    <Card className="p-5">
      <form id="appearance-form" action={formAction} noValidate className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Tema</legend>
          {(
            [
              ['light', 'Claro'],
              ['dark', 'Escuro'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="theme" value={value} defaultChecked={initial.theme === value} />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Exibição</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showPrices" defaultChecked={initial.showPrices} />
            Mostrar preços
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showMedia" defaultChecked={initial.showMedia} />
            Mostrar fotos
          </label>
        </fieldset>

        <div className="flex flex-col gap-2">
          {allowBranding ? null : (
            <div className="rounded-control bg-subtle p-3 text-sm">
              <p className="font-medium">Recurso do plano Pro</p>
              <p className="text-ink-muted">Assine o Pro para usar logo, cor da marca e banner.</p>
            </div>
          )}
          <fieldset disabled={!allowBranding} className="flex flex-col gap-3 disabled:opacity-60">
            <legend className="mb-1 font-medium">Marca</legend>
            <label className="flex items-center gap-3">
              <input type="color" name="brandColor" defaultValue={initial.brandColor} className="h-10 w-14" />
              Cor da marca
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="bannerEnabled" defaultChecked={initial.bannerEnabled} />
              Mostrar banner
            </label>
          </fieldset>
        </div>

        <FormMessage error={state.error} success={state.success} />
        <Button type="submit" disabled={pending} className="self-start">
          Salvar aparência
        </Button>
      </form>
      {/* Logo e banner são enviados na hora, fora do formulário. */}
      <div className="mt-6 flex flex-col gap-5 border-t border-line pt-5">
        <ImageSlot label="Logo" role="logo" vitrineId={vitrineId} initial={logo} removable disabled={!allowBranding} />
        <ImageSlot label="Banner" role="banner" vitrineId={vitrineId} initial={banner} removable disabled={!allowBranding} />
      </div>
      <UnsavedChangesGuard formId="appearance-form" />
    </Card>
  )
}

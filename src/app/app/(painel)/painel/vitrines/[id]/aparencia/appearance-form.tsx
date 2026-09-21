'use client'

import { Crown, Lock, Moon, Sun } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { VideoSlot } from '@/components/media/video-slot'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { ConfigBlock, ConfigToggle, SaveBar } from '@/components/ui/config-section'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/submit-button'
import { UnsavedChangesGuard } from '@/components/ui/unsaved-changes'
import { updateAppearanceAction } from '@/features/vitrines/actions'
import { readableTextColor } from '@/lib/color/contrast'
import { initialFormState } from '@/lib/forms/form-state'

type Appearance = {
  theme: 'light' | 'dark'
  showPrices: boolean
  showMedia: boolean
  brandColor: string
  bannerEnabled: boolean
}

type Slot = { id: string; url: string } | null

const THEMES = [
  ['light', 'Claro', Sun, 'bg-white', 'bg-[#e9ece8]'],
  ['dark', 'Escuro', Moon, 'bg-[#0e1411]', 'bg-[#2c362f]'],
] as const

const HEX = /^#[0-9a-f]{6}$/i

function ProBadge() {
  return (
    <Badge tone="sun">
      <Crown aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      Pro
    </Badge>
  )
}

export function AppearanceForm({
  vitrineId,
  allowBranding,
  logo,
  banner,
  bannerVideo,
  videoLimits,
  buttonText,
  initial,
}: {
  vitrineId: string
  allowBranding: boolean
  logo: Slot
  banner: Slot
  bannerVideo: { id: string; status: 'processing' | 'ready' | 'failed'; thumbnailUrl: string | null } | null
  videoLimits: { maxSeconds: number; maxUploadMb: number }
  buttonText: string
  initial: Appearance
}) {
  const [state, formAction, pending] = useActionState(updateAppearanceAction.bind(null, vitrineId), initialFormState)
  const [color, setColor] = useState(initial.brandColor)
  const previewColor = HEX.test(color) ? color : '#673de6'

  return (
    <>
      <form id="appearance-form" action={formAction} noValidate className="flex flex-col gap-5">
        <ConfigBlock title="Tema" description="O fundo da vitrine. Escolha o que combina com as suas fotos.">
          <fieldset>
            <legend className="sr-only">Tema</legend>
            <div className="grid grid-cols-2 gap-3.5">
              {THEMES.map(([value, label, Icon, ground, bar]) => (
                <ChoiceCard
                  key={value}
                  name="theme"
                  value={value}
                  defaultChecked={initial.theme === value}
                  aria-label={label}
                  layout="stack"
                  title={
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-5" strokeWidth={2.5} />
                      {label}
                    </span>
                  }
                  icon={
                    <span aria-hidden="true" className={`flex h-24 flex-col gap-1.5 rounded-control border-2 border-line p-2.5 ${ground}`}>
                      <span className={`h-9 rounded-md ${bar}`} />
                      <span className="flex gap-1.5">
                        <span className={`h-6 flex-1 rounded-md ${bar}`} />
                        <span className={`h-6 flex-1 rounded-md ${bar}`} />
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
          </fieldset>
        </ConfigBlock>

        <ConfigBlock title="Exibição" description="O que aparece em cada item da vitrine.">
          <div className="flex flex-col divide-y-2 divide-line">
            <ConfigToggle
              id="showPrices"
              name="showPrices"
              title="Mostrar preços"
              description="Desligado, os itens aparecem sem preço."
              defaultChecked={initial.showPrices}
              className="pb-4"
            />
            <ConfigToggle
              id="showMedia"
              name="showMedia"
              title="Mostrar fotos"
              description="Desligado, os itens aparecem sem foto."
              defaultChecked={initial.showMedia}
              className="pt-4"
            />
          </div>
        </ConfigBlock>

        <ConfigBlock title="Marca" description="A cor dos botões e o banner no topo da vitrine." aside={<ProBadge />}>
          {allowBranding ? null : (
            <div className="flex flex-col gap-3 border-b-2 border-dashed border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sun-ink" strokeWidth={2.5} />
                <div className="flex flex-col gap-0.5">
                  <p className="font-black text-sun-ink">Recurso do plano Pro</p>
                  <p className="text-sm font-semibold text-sun-ink/85">Assine o Pro para usar logo, cor da marca e banner.</p>
                </div>
              </div>
              <Link href="/painel/plano" className={buttonClasses('sun', 'shrink-0', 'sm')}>
                Ver o plano Pro
              </Link>
            </div>
          )}
          <fieldset disabled={!allowBranding} className="flex min-w-0 flex-col gap-5 disabled:opacity-60">
            <legend className="sr-only">Marca</legend>
            <div className="flex flex-col gap-3">
              <label htmlFor="brandColor" className="text-[0.9375rem] font-extrabold text-ink">
                Cor da marca
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <input
                    id="brandColor"
                    type="color"
                    name="brandColor"
                    defaultValue={initial.brandColor}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-14 w-20 cursor-pointer rounded-control border-2 border-line-strong bg-surface p-1 disabled:cursor-not-allowed [&::-moz-color-swatch]:rounded-[0.5rem] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[0.5rem] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <span className="numeric font-extrabold text-ink-muted">{previewColor.toUpperCase()}</span>
                </div>
                {/* Prévia viva: o botão da vitrine na cor escolhida, com o texto no contraste que a vitrine usa. */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5" aria-hidden="true">
                  <span className="text-xs font-extrabold text-ink-muted">Na vitrine</span>
                  <span
                    className="flex h-11 items-center justify-center truncate rounded-control px-4 font-bold transition-colors duration-200"
                    style={{ backgroundColor: previewColor, color: readableTextColor(previewColor) }}
                  >
                    {buttonText}
                  </span>
                </div>
              </div>
            </div>
            <ConfigToggle
              id="bannerEnabled"
              name="bannerEnabled"
              title="Mostrar banner"
              description="A imagem ou o vídeo do banner aparece no topo."
              defaultChecked={initial.bannerEnabled}
            />
          </fieldset>
        </ConfigBlock>

        <SaveBar>
          <FormMessage error={state.error} success={state.success} />
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full lg:w-auto lg:self-start">
            {pending ? <Spinner /> : null}
            Salvar aparência
          </Button>
        </SaveBar>
      </form>

      {/* Logo e banner são enviados na hora, fora do formulário. */}
      <ConfigBlock
        title="Logo e banner"
        description="Enviados na hora, sem precisar salvar."
        aside={<ProBadge />}
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <ImageSlot label="Logo" role="logo" vitrineId={vitrineId} initial={logo} removable disabled={!allowBranding} />
          <ImageSlot label="Banner" role="banner" vitrineId={vitrineId} initial={banner} removable disabled={!allowBranding} />
        </div>
        <VideoSlot
          label="Banner em vídeo"
          role="banner"
          vitrineId={vitrineId}
          initial={bannerVideo}
          limits={videoLimits}
          disabled={!allowBranding}
        />
        <p className="text-sm font-semibold text-ink-muted">
          O banner mostra a imagem ou o vídeo enviado por último. Vídeo só horizontal.
        </p>
      </ConfigBlock>
      <UnsavedChangesGuard formId="appearance-form" />
    </>
  )
}

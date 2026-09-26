'use client'

import { ChevronDown, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { ImageSlot } from '@/components/media/image-slot'
import { Badge } from '@/components/ui/badge'
import { BusinessHoursEditor } from '@/components/ui/business-hours-editor'
import { Button, buttonClasses } from '@/components/ui/button'
import { ConfigBlock, ConfigToggle } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/submit-button'
import { deleteProfessionalAction, saveProfessionalAction } from '@/features/professionals/actions'
import type { PanelProfessional } from '@/features/professionals/queries'
import { initialFormState, type FormState } from '@/lib/forms/form-state'
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from '@/lib/vitrines/service-segments'

type Service = { id: string; name: string }

export function Professionals({
  vitrineId,
  services,
  professionals,
}: {
  vitrineId: string
  services: Service[]
  professionals: PanelProfessional[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState<FormState>({})
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteProfessionalAction(vitrineId, id)
      setMessage(result)
      if (!result.error) router.refresh()
    })
  }

  if (services.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface px-5 py-4 font-semibold text-ink-muted">
        Cadastre pelo menos um serviço antes de adicionar profissionais.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" className="empty:absolute">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {professionals.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {professionals.map((professional) => (
            <li key={professional.id} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                {professional.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={professional.avatar.url}
                    alt=""
                    className="size-12 shrink-0 rounded-control object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-control bg-go-soft text-go-strong"
                  >
                    <UserRound className="size-6" strokeWidth={2.5} />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="min-w-0 break-words text-lg font-black leading-snug tracking-[-0.02em] text-ink">
                      {professional.name}
                    </h3>
                    {professional.active ? null : <Badge tone="neutral">Inativo</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-ink-muted">
                    {professional.itemIds.length === 1 ? '1 serviço' : `${professional.itemIds.length} serviços`}
                    {professional.businessHours ? ' · horário próprio' : ' · horário da vitrine'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Remover ${professional.name}`}
                  className="shrink-0 text-danger hover:bg-danger-soft active:bg-danger-soft"
                  onClick={() => remove(professional.id)}
                >
                  <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />
                  Remover
                </Button>
              </div>

              <details className="group/edit border-t border-line pt-4">
                <summary
                  className={buttonClasses(
                    'ghost',
                    '-ml-2 w-fit cursor-pointer list-none text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden',
                    'sm',
                  )}
                >
                  <Pencil aria-hidden="true" className="size-4" strokeWidth={2.5} />
                  Editar profissional
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-open/edit:rotate-180"
                    strokeWidth={3}
                  />
                </summary>
                <div className="pt-4">
                  <ProfessionalForm
                    vitrineId={vitrineId}
                    services={services}
                    professional={professional}
                    onSaved={() => router.refresh()}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfigBlock
        title="Adicionar profissional"
        description="O cliente escolhe o profissional na hora de agendar. Cada um tem a própria agenda."
      >
        <ProfessionalForm vitrineId={vitrineId} services={services} onSaved={() => router.refresh()} />
      </ConfigBlock>
    </div>
  )
}

function ProfessionalForm({
  vitrineId,
  services,
  professional,
  onSaved,
}: {
  vitrineId: string
  services: Service[]
  professional?: PanelProfessional
  onSaved: () => void
}) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveProfessionalAction(vitrineId, professional?.id ?? null, prev, formData)
    if (result.success) onSaved()
    return result
  }, initialFormState)
  const errors = state.fieldErrors ?? {}

  const [itemIds, setItemIds] = useState<string[]>(professional?.itemIds ?? services.map((service) => service.id))
  const [ownHours, setOwnHours] = useState(Boolean(professional?.businessHours))
  const [hours, setHours] = useState<BusinessHours>(professional?.businessHours ?? DEFAULT_BUSINESS_HOURS)
  const [avatarId, setAvatarId] = useState(professional?.avatar?.id ?? '')
  const prefix = professional?.id ?? 'novo'

  function toggleService(id: string) {
    setItemIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="itemIds" value={JSON.stringify(itemIds)} />
      <input type="hidden" name="businessHours" value={JSON.stringify(hours)} />
      <input type="hidden" name="avatarMediaId" value={avatarId} />

      <div className="flex flex-wrap items-start gap-5">
        <ImageSlot
          label="Foto"
          role="avatar"
          vitrineId={vitrineId}
          professionalId={professional?.id ?? null}
          initial={professional?.avatar ?? null}
          removable
          onChange={(media) => setAvatarId(media?.id ?? '')}
        />
        <div className="flex min-w-48 flex-1 flex-col gap-5">
          <Field label="Nome" htmlFor={`name-${prefix}`} error={errors.name}>
            <Input
              id={`name-${prefix}`}
              name="name"
              maxLength={60}
              placeholder="Ex.: Ana"
              defaultValue={state.values?.name ?? professional?.name ?? ''}
              invalid={!!errors.name}
            />
          </Field>
          <ConfigToggle
            id={`active-${prefix}`}
            name="active"
            title="Atendendo"
            description="Desligado, ele some da vitrine e não recebe agendamentos."
            defaultChecked={professional?.active ?? true}
            className="rounded-control bg-canvas p-4"
          />
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-[0.9375rem] font-extrabold leading-5 text-ink">Serviços que ele faz</legend>
        <ul className="flex flex-col divide-y divide-line rounded-control border-2 border-line">
          {services.map((service) => (
            <li key={service.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5 font-bold text-ink hover:bg-canvas">
                <input
                  type="checkbox"
                  checked={itemIds.includes(service.id)}
                  onChange={() => toggleService(service.id)}
                  className="size-5 shrink-0 accent-go-strong"
                />
                {service.name}
              </label>
            </li>
          ))}
        </ul>
        <FormMessage error={errors.itemIds} />
      </fieldset>

      <ConfigToggle
        id={`ownHours-${prefix}`}
        name="ownHours"
        title="Horário próprio"
        description="Desligado, ele atende nos horários da vitrine."
        checked={ownHours}
        onChange={(event) => setOwnHours(event.currentTarget.checked)}
        className="rounded-control bg-canvas p-4"
      />
      {ownHours ? (
        <div className="flex flex-col gap-2">
          <BusinessHoursEditor hours={hours} onChange={setHours} />
          <FormMessage error={errors.businessHours} />
        </div>
      ) : null}

      <FormMessage error={state.error} success={state.success} />
      <Button
        type="submit"
        variant={professional ? 'secondary' : 'primary'}
        disabled={pending}
        aria-busy={pending}
        className="w-full sm:w-auto sm:self-start"
      >
        {pending ? <Spinner /> : professional ? null : <Plus aria-hidden="true" className="size-5" strokeWidth={3} />}
        {professional ? 'Salvar profissional' : 'Adicionar profissional'}
      </Button>
    </form>
  )
}

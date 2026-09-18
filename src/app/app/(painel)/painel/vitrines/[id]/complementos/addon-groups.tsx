'use client'

import { ChevronDown, Layers, Pencil, Pizza, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { ConfigBlock, ConfigToggle } from '@/components/ui/config-section'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input, Select } from '@/components/ui/input'
import { DragHandle, SortableItem, SortableList } from '@/components/ui/sortable-list'
import { Spinner } from '@/components/ui/submit-button'
import { deleteAddonGroupAction, reorderAddonGroupsAction, saveAddonGroupAction } from '@/features/addons/actions'
import { groupBadge, type AddonGroup } from '@/lib/addons/addons'
import { ADDON_TEMPLATES } from '@/lib/addons/templates'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput, formatBRL } from '@/lib/money/money'

type OptionRow = { key: string; id: string | null; name: string; price: string; soldOut: boolean }
type Draft = {
  name: string
  kind: 'standard' | 'flavors'
  required: boolean
  minSelect: number
  maxSelect: number
  allowRepeat: boolean
  flavorPriceRule: 'max' | 'average' | null
  options: OptionRow[]
}

const newKey = () => Math.random().toString(36).slice(2)

const BLANK: Draft = {
  name: '', kind: 'standard', required: false, minSelect: 0, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
  options: [{ key: 'blank', id: null, name: '', price: '', soldOut: false }],
}

const KINDS = [
  ['standard', 'Padrão', 'Adicionais, ponto da carne, bebidas.', Layers],
  ['flavors', 'Sabores de pizza', 'Meia a meia: o preço segue a regra que você escolher.', Pizza],
] as const

function draftFromGroup(group: AddonGroup): Draft {
  return {
    ...group,
    options: group.options.map((option) => ({
      key: option.id, id: option.id, name: option.name, price: centsToInput(option.priceCents), soldOut: option.soldOut,
    })),
  }
}

export function AddonGroups({ vitrineId, groups: serverGroups }: { vitrineId: string; groups: AddonGroup[] }) {
  const router = useRouter()
  const [template, setTemplate] = useState('')
  const [draftVersion, setDraftVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [reordering, startReorder] = useTransition()
  // Cópia local para a ordem mudar na hora ao soltar; volta a seguir o servidor quando ele manda a lista nova.
  const [lastServer, setLastServer] = useState(serverGroups)
  const [groups, setGroups] = useState(serverGroups)
  if (lastServer !== serverGroups) {
    setLastServer(serverGroups)
    setGroups(serverGroups)
  }

  function reorder(orderedIds: string[]) {
    const previous = groups
    const byId = new Map(previous.map((group) => [group.id, group]))
    setGroups(orderedIds.map((id) => byId.get(id)!))
    setNotice(null)
    setReorderError(null)
    startReorder(async () => {
      const result = await reorderAddonGroupsAction(vitrineId, orderedIds)
      if (result.error) {
        setReorderError(result.error)
        setGroups(previous)
      } else {
        setNotice(result.success ?? null)
        router.refresh()
      }
    })
  }

  const templateDraft: Draft = (() => {
    const found = ADDON_TEMPLATES.find((item) => item.key === template)
    if (!found) return BLANK
    return {
      ...found.group,
      options: found.options.map((option) => ({ key: newKey(), id: null, name: option.name, price: centsToInput(option.priceCents), soldOut: false })),
    }
  })()

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <FormMessage error={reorderError ?? undefined} success={notice ?? undefined} />
      </div>

      {groups.length > 0 ? (
        <SortableList
          entries={groups.map((group) => ({ id: group.id, label: group.name }))}
          onReorder={reorder}
          disabled={reordering}
        >
          <ul className="flex flex-col gap-4">
            {groups.map((group) => (
              <SortableItem
                key={group.id}
                id={group.id}
                placeholderClassName="rounded-card"
                className="rounded-card border-2 border-line bg-surface p-5 sm:p-6"
              >
                <AddonGroupForm
                  // Remonta quando os ids das opções mudam: opções recém-criadas ganham id e o próximo
                  // "Salvar grupo" atualiza em vez de recriar (sacolas guardam esses ids).
                  key={`${group.id}-${group.options.map((option) => option.id).join(',')}`}
                  vitrineId={vitrineId}
                  groupId={group.id}
                  group={group}
                  handle={<DragHandle label={`Reordenar grupo ${group.name}`} className="-my-1.5 -ml-3 size-11 rounded-full" />}
                  initial={draftFromGroup(group)}
                  onSaved={() => router.refresh()}
                  footer={
                    <DeleteGroupButton
                      vitrineId={vitrineId}
                      groupId={group.id}
                      onDeleted={(message) => {
                        setNotice(message)
                        router.refresh()
                      }}
                    />
                  }
                />
              </SortableItem>
            ))}
          </ul>
        </SortableList>
      ) : (
        <p className="rounded-card border-2 border-dashed border-line-strong px-5 py-6 text-center font-semibold text-ink-muted">
          Nenhum grupo ainda. Comece por um modelo pronto aqui embaixo.
        </p>
      )}

      <ConfigBlock title="Novo grupo" description="Um modelo já traz nome, regras e opções. Ajuste o que quiser antes de salvar.">
        <Field label="Começar de um modelo" htmlFor="addon-template">
          <Select
            id="addon-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value)
              setDraftVersion((version) => version + 1)
            }}
          >
            <option value="">Em branco</option>
            {ADDON_TEMPLATES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="border-t-2 border-line pt-5">
          <AddonGroupForm
            key={`novo-${draftVersion}`}
            vitrineId={vitrineId}
            groupId={null}
            initial={templateDraft}
            onSaved={() => {
              setNotice('Grupo salvo.')
              setTemplate('')
              setDraftVersion((version) => version + 1)
              router.refresh()
            }}
          />
        </div>
      </ConfigBlock>
    </div>
  )
}

function DeleteGroupButton(props: { vitrineId: string; groupId: string; onDeleted: (message: string) => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-danger hover:bg-danger-soft active:bg-danger-soft"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Excluir este grupo? Ele sai de todos os itens.')) return
          startTransition(async () => {
            const result = await deleteAddonGroupAction(props.vitrineId, props.groupId)
            if (result.error) setError(result.error)
            else props.onDeleted(result.success ?? 'Grupo excluído.')
          })
        }}
      >
        {pending ? <Spinner /> : <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.5} />}
        Excluir grupo
      </Button>
      <FormMessage error={error ?? undefined} />
    </div>
  )
}

// Resumo do grupo salvo: nome, regra e opções com preço.
function GroupSummary({ group, handle }: { group: AddonGroup; handle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-1">
        {handle}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="min-w-0 break-words text-lg font-black leading-snug tracking-[-0.02em] text-ink">{group.name}</h3>
          <Badge tone={group.minSelect > 0 ? 'deep' : 'neutral'}>{groupBadge(group)}</Badge>
          {group.kind === 'flavors' ? (
            <Badge tone="go">
              Sabores · {group.flavorPriceRule === 'average' ? 'preço pela média' : 'vale o maior preço'}
            </Badge>
          ) : null}
        </div>
      </div>
      {group.options.length > 0 ? (
        <ul className="flex flex-col divide-y-2 divide-line rounded-control border-2 border-line">
          {group.options.map((option) => (
            <li key={option.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className={`min-w-0 break-words font-bold ${option.soldOut ? 'text-ink-muted line-through' : 'text-ink'}`}>
                {option.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {option.soldOut ? <Badge tone="danger">Esgotada</Badge> : null}
                <span className="numeric text-sm font-extrabold text-ink-muted">
                  {option.priceCents > 0 ? `+ ${formatBRL(option.priceCents)}` : 'Sem custo'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function AddonGroupForm(props: {
  vitrineId: string
  groupId: string | null
  group?: AddonGroup
  initial: Draft
  onSaved: () => void
  footer?: ReactNode
  /** Alça de arrastar o grupo inteiro (só nos grupos já salvos). */
  handle?: ReactNode
}) {
  const prefix = props.groupId ?? 'novo'
  const [kind, setKind] = useState(props.initial.kind)
  const [required, setRequired] = useState(props.initial.required)
  const [options, setOptions] = useState<OptionRow[]>(props.initial.options)
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveAddonGroupAction(props.vitrineId, props.groupId, prev, formData)
    if (result.success) props.onSaved()
    return result
  }, {})
  const errors = state.fieldErrors ?? {}

  const updateOption = (key: string, patch: Partial<OptionRow>) =>
    setOptions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const fields = (
    <div className="flex flex-col gap-5">
      <Field label="Nome do grupo" htmlFor={`${prefix}-name`} error={errors.name}>
        <Input id={`${prefix}-name`} name="name" maxLength={40} defaultValue={props.initial.name} invalid={!!errors.name} />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[0.9375rem] font-extrabold text-ink">Tipo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map(([value, label, description, Icon]) => (
            <ChoiceCard
              key={value}
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              aria-label={label}
              title={label}
              description={description}
              icon={
                <span className="flex size-10 items-center justify-center rounded-control bg-subtle text-ink">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={2.5} />
                </span>
              }
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4 rounded-control bg-canvas p-4">
        <ConfigToggle
          id={`${prefix}-required`}
          name="required"
          title="Obrigatório"
          description="O cliente precisa escolher antes de pedir."
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
        />
        <div className="grid grid-cols-2 gap-3">
          {required ? (
            <Field label="Mínimo" htmlFor={`${prefix}-min`} error={errors.minSelect}>
              <Input
                id={`${prefix}-min`}
                name="minSelect"
                inputMode="numeric"
                className="numeric"
                defaultValue={String(Math.max(1, props.initial.minSelect))}
                invalid={!!errors.minSelect}
              />
            </Field>
          ) : (
            <input type="hidden" name="minSelect" value="0" />
          )}
          <Field label="Máximo" htmlFor={`${prefix}-max`} error={errors.maxSelect}>
            <Input
              id={`${prefix}-max`}
              name="maxSelect"
              inputMode="numeric"
              className="numeric"
              defaultValue={String(props.initial.maxSelect)}
              invalid={!!errors.maxSelect}
            />
          </Field>
        </div>
        {kind === 'flavors' ? (
          <Field label="Preço dos sabores" htmlFor={`${prefix}-rule`} error={errors.flavorPriceRule}>
            <Select id={`${prefix}-rule`} name="flavorPriceRule" defaultValue={props.initial.flavorPriceRule ?? 'max'}>
              <option value="max">Maior preço</option>
              <option value="average">Média</option>
            </Select>
          </Field>
        ) : (
          <>
            <input type="hidden" name="flavorPriceRule" value="" />
            <ConfigToggle
              id={`${prefix}-repeat`}
              name="allowRepeat"
              title="Permitir repetir a mesma opção"
              description="Ex.: 2x bacon."
              defaultChecked={props.initial.allowRepeat}
            />
          </>
        )}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[0.9375rem] font-extrabold text-ink">Opções</legend>
        {errors.options ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {errors.options}
          </p>
        ) : null}
        {/* A ordem da lista é a ordem de exibição: a posição sai daqui ao salvar o grupo. */}
        <SortableList
          entries={options.map((row, index) => ({ id: row.key, label: row.name.trim() || `Opção ${index + 1}` }))}
          onReorder={(orderedKeys) =>
            setOptions((rows) => orderedKeys.map((key) => rows.find((row) => row.key === key)!))
          }
        >
          <ol className="flex flex-col gap-3">
            {options.map((row, index) => {
              const n = index + 1
              return (
                <SortableItem
                  key={row.key}
                  id={row.key}
                  className="flex items-start gap-1 rounded-control border-2 border-line bg-surface py-3 pl-1 pr-3"
                >
                  <DragHandle label={`Reordenar opção ${n}`} className="h-12 w-9 rounded-control" />
                  <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-2.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto_auto] sm:items-center">
                    <Input
                      aria-label={`Nome da opção ${n}`}
                      placeholder="Nome"
                      maxLength={40}
                      value={row.name}
                      onChange={(e) => updateOption(row.key, { name: e.target.value })}
                      className="col-span-2 sm:col-span-1"
                    />
                    <div className="relative">
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-extrabold text-ink-muted">
                        R$
                      </span>
                      <Input
                        aria-label={`Preço da opção ${n}`}
                        placeholder="0,00"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(e) => updateOption(row.key, { price: e.target.value })}
                        className="numeric pl-10"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1 sm:contents">
                      <label className="flex h-12 cursor-pointer items-center gap-2 rounded-control px-2 text-sm font-extrabold text-ink-muted">
                        <input
                          type="checkbox"
                          aria-label={`Opção ${n} esgotada`}
                          checked={row.soldOut}
                          onChange={(e) => updateOption(row.key, { soldOut: e.target.checked })}
                          className="size-5 accent-go-strong"
                        />
                        Esgotada
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover opção ${n}`}
                        className="size-10 px-0 text-ink-muted hover:text-danger"
                        onClick={() => setOptions((rows) => rows.filter((r) => r.key !== row.key))}
                      >
                        <X aria-hidden="true" className="size-5" strokeWidth={3} />
                      </Button>
                    </div>
                  </div>
                </SortableItem>
              )
            })}
          </ol>
        </SortableList>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={options.length >= 50}
          onClick={() => setOptions((rows) => [...rows, { key: newKey(), id: null, name: '', price: '', soldOut: false }])}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
          Adicionar opção
        </Button>
      </fieldset>

      <FormMessage error={state.error} success={props.groupId ? state.success : undefined} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
          {pending ? <Spinner /> : null}
          Salvar grupo
        </Button>
        {props.footer}
      </div>
    </div>
  )

  return (
    <form
      action={formAction}
      noValidate
      aria-label={props.groupId ? `Grupo ${props.initial.name}` : 'Novo grupo'}
      className="flex flex-col gap-4"
    >
      <input
        type="hidden"
        name="options"
        value={JSON.stringify(options.map(({ id, name, price, soldOut }) => ({ id, name, price, soldOut })))}
      />
      {props.group ? (
        <>
          <GroupSummary group={props.group} handle={props.handle} />
          {/* A edição fica recolhida: a lista mostra o essencial e cada grupo abre quando precisa. */}
          <details className="group/edit">
            <summary
              className={buttonClasses(
                'secondary',
                'w-full cursor-pointer list-none sm:w-auto [&::-webkit-details-marker]:hidden',
                'sm',
              )}
            >
              <Pencil aria-hidden="true" className="size-4" strokeWidth={2.5} />
              Editar grupo
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-open/edit:rotate-180"
                strokeWidth={3}
              />
            </summary>
            <div className="mt-5 border-t-2 border-line pt-5">{fields}</div>
          </details>
        </>
      ) : (
        fields
      )}
    </form>
  )
}

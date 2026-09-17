'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteAddonGroupAction, saveAddonGroupAction } from '@/features/addons/actions'
import type { AddonGroup } from '@/lib/addons/addons'
import { ADDON_TEMPLATES } from '@/lib/addons/templates'
import type { FormState } from '@/lib/forms/form-state'
import { centsToInput } from '@/lib/money/money'

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
const selectClass = 'h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base'

const BLANK: Draft = {
  name: '', kind: 'standard', required: false, minSelect: 0, maxSelect: 1, allowRepeat: false, flavorPriceRule: null,
  options: [{ key: 'blank', id: null, name: '', price: '', soldOut: false }],
}

function draftFromGroup(group: AddonGroup): Draft {
  return {
    ...group,
    options: group.options.map((option) => ({
      key: option.id, id: option.id, name: option.name, price: centsToInput(option.priceCents), soldOut: option.soldOut,
    })),
  }
}

export function AddonGroups({ vitrineId, groups }: { vitrineId: string; groups: AddonGroup[] }) {
  const router = useRouter()
  const [template, setTemplate] = useState('')
  const [draftVersion, setDraftVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const templateDraft: Draft = (() => {
    const found = ADDON_TEMPLATES.find((item) => item.key === template)
    if (!found) return BLANK
    return {
      ...found.group,
      options: found.options.map((option) => ({ key: newKey(), id: null, name: option.name, price: centsToInput(option.priceCents), soldOut: false })),
    }
  })()

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        <FormMessage success={notice ?? undefined} />
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-medium">Novo grupo</h2>
        <Field label="Começar de um modelo" htmlFor="addon-template">
          <select
            id="addon-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value)
              setDraftVersion((version) => version + 1)
            }}
            className={selectClass}
          >
            <option value="">Em branco</option>
            {ADDON_TEMPLATES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
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
      </Card>

      {groups.map((group) => (
        <Card key={group.id} className="flex flex-col gap-3 p-5">
          <AddonGroupForm
            // Remonta quando os ids das opções mudam: opções recém-criadas ganham id e o próximo
            // "Salvar grupo" atualiza em vez de recriar (sacolas guardam esses ids).
            key={`${group.id}-${group.options.map((option) => option.id).join(',')}`}
            vitrineId={vitrineId}
            groupId={group.id}
            initial={draftFromGroup(group)}
            onSaved={() => router.refresh()}
          />
          <DeleteGroupButton
            vitrineId={vitrineId}
            groupId={group.id}
            onDeleted={(message) => {
              setNotice(message)
              router.refresh()
            }}
          />
        </Card>
      ))}
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
        className="self-start"
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
        Excluir grupo
      </Button>
      <FormMessage error={error ?? undefined} />
    </div>
  )
}

function AddonGroupForm(props: {
  vitrineId: string
  groupId: string | null
  initial: Draft
  onSaved: () => void
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
      <Field label="Nome do grupo" htmlFor={`${prefix}-name`} error={errors.name}>
        <Input id={`${prefix}-name`} name="name" maxLength={40} defaultValue={props.initial.name} invalid={!!errors.name} />
      </Field>
      <Field label="Tipo" htmlFor={`${prefix}-kind`}>
        <select
          id={`${prefix}-kind`}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as Draft['kind'])}
          className={selectClass}
        >
          <option value="standard">Padrão</option>
          <option value="flavors">Sabores de pizza</option>
        </select>
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="required" checked={required} onChange={(event) => setRequired(event.target.checked)} />
        Obrigatório
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {required ? (
          <Field label="Mínimo" htmlFor={`${prefix}-min`} error={errors.minSelect}>
            <Input id={`${prefix}-min`} name="minSelect" inputMode="numeric" defaultValue={String(Math.max(1, props.initial.minSelect))} invalid={!!errors.minSelect} />
          </Field>
        ) : (
          <input type="hidden" name="minSelect" value="0" />
        )}
        <Field label="Máximo" htmlFor={`${prefix}-max`} error={errors.maxSelect}>
          <Input id={`${prefix}-max`} name="maxSelect" inputMode="numeric" defaultValue={String(props.initial.maxSelect)} invalid={!!errors.maxSelect} />
        </Field>
      </div>
      {kind === 'flavors' ? (
        <Field label="Preço dos sabores" htmlFor={`${prefix}-rule`} error={errors.flavorPriceRule}>
          <select id={`${prefix}-rule`} name="flavorPriceRule" defaultValue={props.initial.flavorPriceRule ?? 'max'} className={selectClass}>
            <option value="max">Maior preço</option>
            <option value="average">Média</option>
          </select>
        </Field>
      ) : (
        <>
          <input type="hidden" name="flavorPriceRule" value="" />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowRepeat" defaultChecked={props.initial.allowRepeat} />
            Permitir repetir a mesma opção
          </label>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Opções</legend>
        {errors.options ? (
          <p role="alert" className="text-sm text-danger">
            {errors.options}
          </p>
        ) : null}
        {options.map((row, index) => {
          const n = index + 1
          return (
            <div key={row.key} className="grid gap-2 rounded-control border border-line p-3 sm:grid-cols-4">
              <Input aria-label={`Nome da opção ${n}`} placeholder="Nome" maxLength={40} value={row.name} onChange={(e) => updateOption(row.key, { name: e.target.value })} />
              <Input aria-label={`Preço da opção ${n}`} placeholder="0,00" inputMode="decimal" value={row.price} onChange={(e) => updateOption(row.key, { price: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Opção ${n} esgotada`}
                  checked={row.soldOut}
                  onChange={(e) => updateOption(row.key, { soldOut: e.target.checked })}
                />
                Esgotada
              </label>
              <Button variant="ghost" aria-label={`Remover opção ${n}`} onClick={() => setOptions((rows) => rows.filter((r) => r.key !== row.key))}>
                Remover
              </Button>
            </div>
          )
        })}
        <Button
          variant="secondary"
          className="self-start"
          disabled={options.length >= 50}
          onClick={() => setOptions((rows) => [...rows, { key: newKey(), id: null, name: '', price: '', soldOut: false }])}
        >
          Adicionar opção
        </Button>
      </fieldset>

      <FormMessage error={state.error} success={props.groupId ? state.success : undefined} />
      <Button type="submit" disabled={pending} className="self-start">
        Salvar grupo
      </Button>
    </form>
  )
}

'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { isSameIdSet, REORDER_STALE_MESSAGE } from '@/lib/vitrines/reorder'
import { addonGroupSchema, type AddonGroupInput } from '@/lib/vitrines/schemas'

const GROUP_FIELDS = ['name', 'kind', 'required', 'minSelect', 'maxSelect', 'allowRepeat', 'flavorPriceRule', 'options'] as const

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

type ServerClient = Awaited<ReturnType<typeof requireActionUser>>['supabase']

// Sincroniza por id: opções que continuam mantêm o id (sacolas e pedidos apontam para ele).
async function syncOptions(supabase: ServerClient, groupId: string, options: AddonGroupInput['options']) {
  const { data: existing, error: existingError } = await supabase.from('addon_options').select('id').eq('group_id', groupId)
  if (existingError) return mapDbError(existingError)
  const keep = new Set(options.map((option) => option.id).filter(Boolean))
  const removed = (existing ?? []).map((option) => option.id).filter((id) => !keep.has(id))
  if (removed.length) {
    const { error } = await supabase.from('addon_options').delete().in('id', removed)
    if (error) return mapDbError(error)
  }
  for (const [position, option] of options.entries()) {
    const values = { name: option.name, price_cents: option.priceCents, sold_out: option.soldOut, position }
    const { error } = option.id
      ? await supabase.from('addon_options').update(values).eq('id', option.id).eq('group_id', groupId)
      : await supabase.from('addon_options').insert({ ...values, group_id: groupId })
    if (error) return mapDbError(error)
  }
  return null
}

export async function saveAddonGroupAction(
  vitrineId: string,
  groupId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, GROUP_FIELDS)
  const parsed = addonGroupSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data

  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const row = {
    name: input.name,
    kind: input.kind,
    required: input.required,
    min_select: input.minSelect,
    max_select: input.maxSelect,
    allow_repeat: input.allowRepeat,
    flavor_price_rule: input.flavorPriceRule,
  }

  let savedId = groupId
  if (!groupId) {
    const { count } = await supabase
      .from('addon_groups')
      .select('id', { count: 'exact', head: true })
      .eq('vitrine_id', vitrineId)
    const { data, error } = await supabase
      .from('addon_groups')
      .insert({ ...row, vitrine_id: vitrineId, position: count ?? 0 })
      .select('id')
      .single()
    if (error) return { error: mapDbError(error), values: fields }
    savedId = data.id
  } else {
    const { error } = await supabase.from('addon_groups').update(row).eq('id', groupId).eq('vitrine_id', vitrineId)
    if (error) return { error: mapDbError(error), values: fields }
  }

  const optionsError = await syncOptions(supabase, savedId!, input.options)
  if (optionsError) return { error: optionsError, values: fields }

  revalidateVitrine(vitrine.subdomain)
  return { success: 'Grupo salvo.', values: fields }
}

export async function deleteAddonGroupAction(vitrineId: string, groupId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase.from('addon_groups').delete().eq('id', groupId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Grupo excluído.' }
}

// Arrastar para reordenar os grupos: grava a ordem inteira, desde que seja exatamente o conjunto atual.
export async function reorderAddonGroupsAction(vitrineId: string, orderedIds: string[]): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { data: groups, error: readError } = await supabase.from('addon_groups').select('id').eq('vitrine_id', vitrineId)
  if (readError) return { error: mapDbError(readError) }
  if (!isSameIdSet((groups ?? []).map((g) => g.id), orderedIds)) return { error: REORDER_STALE_MESSAGE }
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from('addon_groups').update({ position }).eq('id', id).eq('vitrine_id', vitrineId),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Ordem salva.' }
}

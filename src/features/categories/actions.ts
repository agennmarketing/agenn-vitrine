'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { moveInList } from '@/lib/vitrines/reorder'
import { categoryNameSchema } from '@/lib/vitrines/schemas'

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

export async function addCategoryAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['name'])
  const parsed = categoryNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { data: last } = await supabase
    .from('categories')
    .select('position')
    .eq('vitrine_id', vitrineId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { error } = await supabase
    .from('categories')
    .insert({ vitrine_id: vitrineId, name: parsed.data.name, position: (last?.position ?? -1) + 1 })
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria adicionada.' }
}

export async function renameCategoryAction(
  vitrineId: string,
  categoryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ['name'])
  const parsed = categoryNameSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', categoryId)
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria renomeada.', values: fields }
}

export async function moveCategoryAction(vitrineId: string, categoryId: string, direction: 'up' | 'down'): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('vitrine_id', vitrineId)
    .order('position')
    .order('created_at')
  const next = moveInList((categories ?? []).map((c) => c.id), categoryId, direction)
  if (!next) return {}
  const results = await Promise.all(
    next.map((id, position) => supabase.from('categories').update({ position }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(vitrine.subdomain)
  return {}
}

export async function deleteCategoryAction(vitrineId: string, categoryId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { count } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .is('deleted_at', null)
  if ((count ?? 0) > 0) return { error: 'Mova ou exclua os itens desta categoria antes.' }
  const { error } = await supabase.from('categories').delete().eq('id', categoryId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Categoria excluída.' }
}

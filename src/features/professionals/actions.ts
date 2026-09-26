'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { professionalSchema, type ProfessionalInput } from '@/lib/vitrines/schemas'

const PROFESSIONAL_FIELDS = ['name', 'active', 'itemIds', 'ownHours', 'businessHours', 'avatarMediaId'] as const

async function ownedServiceVitrine(vitrineId: string) {
  const session = await requireActionUser()
  const { data: vitrine } = await session.supabase
    .from('vitrines')
    .select('id, subdomain, type')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine) redirect('/painel')
  if (vitrine.type !== 'servicos') redirect(`/painel/vitrines/${vitrineId}/itens`)
  return { ...session, vitrine }
}

/*
 * Cria ou atualiza um profissional: nome, foto, serviços que ele atende e, quando
 * tem horário próprio, os dias dele. A foto é enviada antes de o profissional
 * existir (professional_id nulo) e só aqui passa a pertencer a ele — mesmo
 * caminho das imagens do item.
 */
export async function saveProfessionalAction(
  vitrineId: string,
  professionalId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, PROFESSIONAL_FIELDS)
  const parsed = professionalSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data
  const keep = { values: fields }

  const { supabase, user, vitrine } = await ownedServiceVitrine(vitrineId)

  // Só serviços desta vitrine.
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id')
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .in('id', input.itemIds)
  if (itemsError) return { error: mapDbError(itemsError), ...keep }
  const itemIds = (items ?? []).map((item) => item.id)
  if (itemIds.length === 0) return { fieldErrors: { itemIds: 'Escolha pelo menos um serviço.' }, ...keep }

  const row = { name: input.name, active: input.active, business_hours: input.businessHours }

  let savedId = professionalId
  if (!professionalId) {
    const { data: last } = await supabase
      .from('professionals')
      .select('position')
      .eq('vitrine_id', vitrineId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data, error } = await supabase
      .from('professionals')
      .insert({ ...row, vitrine_id: vitrineId, position: (last?.position ?? -1) + 1 })
      .select('id')
      .single()
    if (error) return { error: mapDbError(error), ...keep }
    savedId = data.id
  } else {
    const { error } = await supabase.from('professionals').update(row).eq('id', professionalId).eq('vitrine_id', vitrineId)
    if (error) return { error: mapDbError(error), ...keep }
  }

  const linkError = await syncItems(supabase, savedId!, itemIds)
  if (linkError) return { error: linkError, ...keep }
  await linkAvatar(user.id, vitrineId, savedId!, input.avatarMediaId)

  revalidateVitrine(vitrine.subdomain)
  return { success: professionalId ? 'Profissional salvo.' : 'Profissional adicionado.', values: fields }
}

type ServerClient = Awaited<ReturnType<typeof requireActionUser>>['supabase']

async function syncItems(supabase: ServerClient, professionalId: string, itemIds: string[]) {
  const { data: existing, error } = await supabase
    .from('professional_items')
    .select('item_id')
    .eq('professional_id', professionalId)
  if (error) return mapDbError(error)

  const current = new Set((existing ?? []).map((link) => link.item_id))
  const wanted = new Set(itemIds)
  const removed = [...current].filter((id) => !wanted.has(id))
  const added = itemIds.filter((id) => !current.has(id))

  if (removed.length > 0) {
    const { error: removeError } = await supabase
      .from('professional_items')
      .delete()
      .eq('professional_id', professionalId)
      .in('item_id', removed)
    if (removeError) return mapDbError(removeError)
  }
  if (added.length > 0) {
    const { error: addError } = await supabase
      .from('professional_items')
      .insert(added.map((itemId) => ({ professional_id: professionalId, item_id: itemId })))
    if (addError) return mapDbError(addError)
  }
  return null
}

async function linkAvatar(userId: string, vitrineId: string, professionalId: string, avatarMediaId: string | null) {
  if (!avatarMediaId) return
  const admin = createSupabaseAdminClient()
  const { data: pending } = await admin
    .from('media')
    .select('id')
    .eq('id', avatarMediaId)
    .eq('owner_id', userId)
    .eq('vitrine_id', vitrineId)
    .eq('role', 'avatar')
    .is('professional_id', null)
    .maybeSingle()
  if (!pending) return
  const { data: previous } = await admin
    .from('media')
    .select('id, storage_paths, mux_upload_id, mux_asset_id')
    .eq('professional_id', professionalId)
    .eq('role', 'avatar')
  await deleteMediaRows(admin, previous ?? [])
  const { error } = await admin.from('media').update({ professional_id: professionalId }).eq('id', avatarMediaId)
  if (error) throw error
}

// Remove o profissional. Os agendamentos dele continuam na Agenda com o nome guardado.
export async function deleteProfessionalAction(vitrineId: string, professionalId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedServiceVitrine(vitrineId)
  const admin = createSupabaseAdminClient()
  const { data: media } = await admin
    .from('media')
    .select('id, storage_paths, mux_upload_id, mux_asset_id')
    .eq('professional_id', professionalId)

  const { error } = await supabase.from('professionals').delete().eq('id', professionalId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  await deleteMediaRows(admin, media ?? [])
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Profissional removido.' }
}

export type { ProfessionalInput }

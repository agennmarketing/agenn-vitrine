'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { ITEM_CODE_MESSAGES } from '@/lib/codes/item-code'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { copyMediaFiles, deleteMediaRows, removeStoredFiles } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { isSameIdSet, moveInList, REORDER_STALE_MESSAGE } from '@/lib/vitrines/reorder'
import { itemSchema, type ItemInput } from '@/lib/vitrines/schemas'

const ITEM_FIELDS = [
  'name', 'description', 'categoryId', 'code', 'priceType', 'price', 'promoPrice', 'durationMinutes', 'tags',
  'soldOut', 'saleMode', 'externalUrl', 'whatsappId', 'buttonText', 'customMessage', 'notice', 'variations',
  'coverMediaId', 'galleryMediaIds', 'videoMediaId',
] as const

export async function saveItemAction(
  vitrineId: string,
  itemId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ITEM_FIELDS)
  const parsed = itemSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data
  const keepValues = { values: fields }

  const { supabase, user } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, type, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  // Serviços viram agendamento: sem duração não dá para reservar o horário.
  const servico = vitrine.type === 'servicos'
  if (servico && input.durationMinutes === null) {
    return { fieldErrors: { durationMinutes: 'Informe a duração do serviço.' }, ...keepValues }
  }

  const admin = createSupabaseAdminClient()
  const { data: cover } = await admin
    .from('media')
    .select('id, item_id')
    .eq('id', input.coverMediaId)
    .eq('owner_id', user.id)
    .eq('vitrine_id', vitrineId)
    .eq('role', 'cover')
    .maybeSingle()
  if (!cover || (cover.item_id !== null && cover.item_id !== itemId)) {
    return { fieldErrors: { coverMediaId: 'Envie a imagem de capa.' }, ...keepValues }
  }

  const code = formData.get('codeAuto') === '1' && !itemId ? null : input.code
  const row = {
    category_id: input.categoryId,
    name: input.name,
    description: input.description,
    price_type: input.priceType,
    price_cents: input.priceCents,
    promo_price_cents: input.promoPriceCents,
    duration_minutes: servico ? input.durationMinutes : null,
    tags: input.tags,
    sold_out: input.soldOut,
    // Forma de venda é coisa de vitrine com sacola; serviço sempre vende agendando.
    sale_mode: servico ? 'whatsapp' : input.saleMode,
    external_url: servico ? null : input.externalUrl,
    whatsapp_id: input.whatsappId,
    button_text: input.buttonText,
    custom_message: input.customMessage,
    notice: servico ? input.notice : null,
  }

  let savedId = itemId
  if (!itemId) {
    const { data: last } = await supabase
      .from('items')
      .select('position')
      .eq('category_id', input.categoryId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data, error } = await supabase
      .from('items')
      // code nulo: o trigger items_before_write gera o próximo código automático.
      .insert({ ...row, vitrine_id: vitrineId, code: code as string, position: (last?.position ?? -1) + 1 })
      .select('id')
      .single()
    if (error) return itemError(error, keepValues)
    savedId = data.id
  } else {
    const { error } = await supabase
      .from('items')
      .update(code ? { ...row, code } : row)
      .eq('id', itemId)
      .is('deleted_at', null)
    if (error) return itemError(error, keepValues)
  }

  const variationError = await syncVariations(supabase, savedId!, input.variations)
  if (variationError) return { error: variationError, ...keepValues }
  await linkPendingMedia(admin, { userId: user.id, vitrineId, itemId: savedId!, input })

  revalidateVitrine(vitrine.subdomain)
  // "novo" deixa a lista comemorar o primeiro item só quando ele acabou de ser criado.
  redirect(`/painel/vitrines/${vitrineId}/itens?salvo=${itemId ? '1' : 'novo'}`)
}

function itemError(error: { code?: string; message?: string; hint?: string }, keep: FormState): FormState {
  if (error.message === 'item_code_taken') return { fieldErrors: { code: ITEM_CODE_MESSAGES.taken }, ...keep }
  return { error: mapDbError(error), ...keep }
}

type ServerClient = Awaited<ReturnType<typeof requireActionUser>>['supabase']

async function syncVariations(supabase: ServerClient, itemId: string, variations: ItemInput['variations']) {
  const { data: existing } = await supabase.from('item_variations').select('id').eq('item_id', itemId)
  const keep = new Set(variations.map((v) => v.id).filter(Boolean))
  const removed = (existing ?? []).map((v) => v.id).filter((id) => !keep.has(id))
  if (removed.length) {
    const { error } = await supabase.from('item_variations').delete().in('id', removed)
    if (error) return mapDbError(error)
  }
  for (const [position, variation] of variations.entries()) {
    const values = {
      name: variation.name,
      price_cents: variation.priceCents,
      promo_price_cents: variation.promoPriceCents,
      sold_out: variation.soldOut,
      position,
    }
    const { error } = variation.id
      ? await supabase.from('item_variations').update(values).eq('id', variation.id).eq('item_id', itemId)
      : await supabase.from('item_variations').insert({ ...values, item_id: itemId })
    if (error) return mapDbError(error)
  }
  return null
}

// Imagens enviadas antes de o item existir (item_id nulo) passam a pertencer a ele.
async function linkPendingMedia(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: { userId: string; vitrineId: string; itemId: string; input: ItemInput },
) {
  const wanted = [
    { id: args.input.coverMediaId, role: 'cover' as const, position: 0 },
    ...args.input.galleryMediaIds.map((id, index) => ({ id, role: 'gallery' as const, position: index + 1 })),
    ...(args.input.videoMediaId ? [{ id: args.input.videoMediaId, role: 'video' as const, position: 0 }] : []),
  ]
  for (const slot of wanted) {
    const { data: pending } = await admin
      .from('media')
      .select('id')
      .eq('id', slot.id)
      .eq('owner_id', args.userId)
      .eq('vitrine_id', args.vitrineId)
      .eq('role', slot.role)
      .is('item_id', null)
      .maybeSingle()
    if (!pending) continue
    let occupied = admin.from('media').select('id, storage_paths, mux_upload_id, mux_asset_id').eq('item_id', args.itemId).eq('role', slot.role)
    if (slot.role === 'gallery') occupied = occupied.eq('position', slot.position)
    const { data: previous } = await occupied
    await deleteMediaRows(admin, previous ?? [])
    const { error } = await admin.from('media').update({ item_id: args.itemId, position: slot.position }).eq('id', slot.id)
    if (error) throw error
  }
}

async function ownedItem(vitrineId: string, itemId: string) {
  const session = await requireActionUser()
  const { data: item } = await session.supabase
    .from('items')
    .select('*, vitrines(subdomain), item_variations(*)')
    .eq('id', itemId)
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!item) redirect(`/painel/vitrines/${vitrineId}/itens`)
  const subdomain = (item.vitrines as { subdomain: string }).subdomain
  return { ...session, item, subdomain }
}

export async function toggleSoldOutAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { error } = await supabase.from('items').update({ sold_out: !item.sold_out }).eq('id', itemId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(subdomain)
  return {}
}

export async function moveItemAction(vitrineId: string, itemId: string, direction: 'up' | 'down'): Promise<FormState> {
  const { supabase, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { data: siblings } = await supabase
    .from('items')
    .select('id')
    .eq('category_id', item.category_id!)
    .is('deleted_at', null)
    .order('position')
    .order('created_at')
  const next = moveInList((siblings ?? []).map((s) => s.id), itemId, direction)
  if (!next) return {}
  const results = await Promise.all(next.map((id, position) => supabase.from('items').update({ position }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(subdomain)
  return {}
}

// Arrastar para reordenar dentro de uma categoria: a categoria sai dos próprios itens enviados,
// e a lista precisa ser exatamente o conjunto atual de itens dela (não excluídos).
export async function reorderItemsAction(vitrineId: string, orderedIds: string[]): Promise<FormState> {
  if (!Array.isArray(orderedIds) || typeof orderedIds[0] !== 'string') return { error: REORDER_STALE_MESSAGE }
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase.from('vitrines').select('id, subdomain').eq('id', vitrineId).maybeSingle()
  if (!vitrine) redirect('/painel')
  const { data: first } = await supabase
    .from('items')
    .select('category_id')
    .eq('id', orderedIds[0])
    .eq('vitrine_id', vitrineId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!first?.category_id) return { error: REORDER_STALE_MESSAGE }
  const { data: siblings, error: readError } = await supabase
    .from('items')
    .select('id')
    .eq('vitrine_id', vitrineId)
    .eq('category_id', first.category_id)
    .is('deleted_at', null)
  if (readError) return { error: mapDbError(readError) }
  if (!isSameIdSet((siblings ?? []).map((s) => s.id), orderedIds)) return { error: REORDER_STALE_MESSAGE }
  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('items').update({ position }).eq('id', id).eq('vitrine_id', vitrineId)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: mapDbError(failed.error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Ordem salva.' }
}

export async function deleteItemAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, user, subdomain } = await ownedItem(vitrineId, itemId)
  const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId)
  if (error) return { error: mapDbError(error) }
  const admin = createSupabaseAdminClient()
  const { data: media } = await admin.from('media').select('id, storage_paths, mux_upload_id, mux_asset_id').eq('item_id', itemId).eq('owner_id', user.id)
  await deleteMediaRows(admin, media ?? [])
  revalidateVitrine(subdomain)
  return { success: 'Item excluído.' }
}

export async function duplicateItemAction(vitrineId: string, itemId: string): Promise<FormState> {
  const { supabase, user, item, subdomain } = await ownedItem(vitrineId, itemId)
  const { data: copy, error } = await supabase
    .from('items')
    .insert({
      vitrine_id: vitrineId,
      category_id: item.category_id,
      // code nulo: o trigger gera o próximo código automático.
      code: null as unknown as string,
      name: `${item.name.slice(0, 72)} (cópia)`,
      description: item.description,
      price_type: item.price_type,
      price_cents: item.price_cents,
      promo_price_cents: item.promo_price_cents,
      duration_minutes: item.duration_minutes,
      tags: item.tags,
      sold_out: item.sold_out,
      position: item.position + 1,
      whatsapp_id: item.whatsapp_id,
      button_text: item.button_text,
      custom_message: item.custom_message,
      notice: item.notice,
    })
    .select('id')
    .single()
  if (error) return { error: mapDbError(error) }

  const variations = (item.item_variations ?? []).map((v) => ({
    item_id: copy.id,
    name: v.name,
    price_cents: v.price_cents,
    promo_price_cents: v.promo_price_cents,
    sold_out: v.sold_out,
    position: v.position,
  }))
  if (variations.length) await supabase.from('item_variations').insert(variations)

  const admin = createSupabaseAdminClient()
  const { data: media } = await admin.from('media').select('*').eq('item_id', itemId).in('role', ['cover', 'gallery'])
  const copiedPaths: string[] = []
  try {
    for (const row of media ?? []) {
      const newId = crypto.randomUUID()
      const storagePaths = await copyMediaFiles(row.storage_paths, `${user.id}/${vitrineId}/${newId}`)
      copiedPaths.push(...Object.values(storagePaths))
      const { error: mediaError } = await admin.from('media').insert({
        id: newId,
        owner_id: user.id,
        vitrine_id: vitrineId,
        item_id: copy.id,
        role: row.role,
        kind: row.kind,
        position: row.position,
        storage_paths: storagePaths,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        status: 'ready',
      })
      if (mediaError) throw mediaError
    }
  } catch {
    await removeStoredFiles(copiedPaths)
    return { error: 'Item duplicado, mas as imagens não foram copiadas. Envie a capa no item novo.' }
  }

  revalidateVitrine(subdomain)
  return { success: 'Item duplicado.' }
}

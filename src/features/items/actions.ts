'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { deleteMediaRows } from '@/lib/media/remove-media'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { itemSchema, type ItemInput } from '@/lib/vitrines/schemas'

const ITEM_FIELDS = [
  'name', 'description', 'categoryId', 'code', 'priceType', 'price', 'promoPrice', 'durationMinutes', 'tags',
  'soldOut', 'whatsappId', 'buttonText', 'customMessage', 'variations', 'coverMediaId', 'galleryMediaIds',
] as const

export async function checkItemCodeAction(code: string, itemId: string | null): Promise<{ ok: boolean; message: string }> {
  const result = validateItemCode(code)
  if (!result.ok) return { ok: false, message: ITEM_CODE_MESSAGES[result.reason] }
  const { supabase } = await requireActionUser()
  const { data, error } = await supabase.rpc('is_item_code_available', { p_code: result.value, p_item_id: itemId ?? undefined })
  if (error) return { ok: false, message: 'Não foi possível verificar agora.' }
  return data ? { ok: true, message: 'Código disponível.' } : { ok: false, message: ITEM_CODE_MESSAGES.taken }
}

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
    duration_minutes: vitrine.type === 'servicos' ? input.durationMinutes : null,
    tags: input.tags,
    sold_out: input.soldOut,
    whatsapp_id: input.whatsappId,
    button_text: input.buttonText,
    custom_message: input.customMessage,
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
  redirect(`/painel/vitrines/${vitrineId}/itens?salvo=1`)
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
    let occupied = admin.from('media').select('id, storage_paths').eq('item_id', args.itemId).eq('role', slot.role)
    if (slot.role === 'gallery') occupied = occupied.eq('position', slot.position)
    const { data: previous } = await occupied
    await deleteMediaRows(admin, previous ?? [])
    const { error } = await admin.from('media').update({ item_id: args.itemId, position: slot.position }).eq('id', slot.id)
    if (error) throw error
  }
}

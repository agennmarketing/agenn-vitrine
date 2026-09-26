'use server'

import * as Sentry from '@sentry/nextjs'
import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { removeStoredFiles, removeVideoAssets } from '@/lib/media/remove-media'
import { storagePathList } from '@/lib/media/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import {
  appearanceSchema,
  checkoutSettingsSchema,
  createVitrineSchema,
  SUBDOMAIN_TAKEN_MESSAGE,
  vitrineSettingsSchema,
} from '@/lib/vitrines/schemas'
import { SEGMENT_COPY } from '@/lib/vitrines/service-segments'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES } from '@/lib/vitrines/vitrine-types'

export async function createVitrineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, [
    'type',
    'serviceSegment',
    'name',
    'subdomain',
    'whatsappLabel',
    'whatsappPhone',
    'instagram',
    'address',
    'businessHours',
    'theme',
  ])
  const parsed = createVitrineSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const input = parsed.data
  const { supabase } = await requireActionUser()
  const { data: vitrineId, error } = await supabase.rpc('create_vitrine', {
    p_type: input.type,
    p_subdomain: input.subdomain,
    p_name: input.name,
    p_theme: input.theme,
    p_default_button_text: DEFAULT_BUTTON_TEXT[input.type],
    p_whatsapp_label: input.whatsappLabel,
    p_whatsapp_phone: input.whatsappPhone,
    // Serviços: as categorias de exemplo seguem o segmento, que só muda textos.
    // Produtos: as categorias de exemplo do tipo.
    p_categories: input.serviceSegment
      ? [...SEGMENT_COPY[input.serviceSegment].categories]
      : [...SAMPLE_CATEGORIES[input.type]],
    p_service_segment: input.serviceSegment ?? undefined,
    p_instagram: input.instagram ?? undefined,
    p_address: input.address ?? undefined,
    p_business_hours: input.businessHours ?? undefined,
  })
  if (error) {
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN_MESSAGE }, values: fields }
    return { error: mapDbError(error), values: fields }
  }

  // Limpa um eventual "Vitrine não encontrada" em cache para este endereço.
  revalidateVitrine(input.subdomain)
  // ?criada=1: a lista de itens comemora a vitrine nova e aponta o próximo passo.
  redirect(`/painel/vitrines/${vitrineId}/itens?criada=1`)
}

async function loadOwnedVitrine(vitrineId: string) {
  const session = await requireActionUser()
  const { data: vitrine } = await session.supabase
    .from('vitrines')
    .select('id, subdomain')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine) redirect('/painel')
  return { ...session, vitrine }
}

export async function updateSettingsAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['name', 'description', 'subdomain'])
  const parsed = vitrineSettingsSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const changingSubdomain = parsed.data.subdomain !== vitrine.subdomain
  if (changingSubdomain && formData.get('confirmSubdomainChange') !== 'on') {
    return {
      fieldErrors: { confirmSubdomainChange: 'Confirme que o link antigo vai parar de funcionar.' },
      values: fields,
    }
  }

  const { error } = await supabase
    .from('vitrines')
    .update({ name: parsed.data.name, description: parsed.data.description, subdomain: parsed.data.subdomain })
    .eq('id', vitrineId)
  if (error) {
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN_MESSAGE }, values: fields }
    return { error: mapDbError(error), values: fields }
  }
  revalidateVitrine(vitrine.subdomain, parsed.data.subdomain)
  return { success: 'Configurações salvas.', values: { ...fields, subdomain: parsed.data.subdomain } }
}

export async function deleteVitrineAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== vitrine.subdomain) {
    return { fieldErrors: { confirm: 'Digite o endereço da vitrine para confirmar.' } }
  }
  let paths: string[]
  let videos: { mux_upload_id: string | null; mux_asset_id: string | null }[]
  try {
    const admin = createSupabaseAdminClient()
    const { data: mediaRows, error: mediaError } = await admin
      .from('media')
      .select('storage_paths, mux_upload_id, mux_asset_id')
      .eq('vitrine_id', vitrineId)
    if (mediaError) throw mediaError
    paths = (mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))
    videos = (mediaRows ?? []).filter((row) => row.mux_upload_id || row.mux_asset_id)
  } catch (error) {
    Sentry.captureException(error)
    return { error: 'Não foi possível excluir agora. Tente novamente.' }
  }
  const { error } = await supabase.from('vitrines').delete().eq('id', vitrineId)
  if (error) return { error: mapDbError(error) }
  await Promise.all([removeStoredFiles(paths), removeVideoAssets(videos)])
  revalidateVitrine(vitrine.subdomain)
  redirect('/painel')
}

const CHECKOUT_FIELDS = [
  'cartEnabled', 'cartButtonText', 'defaultButtonText',
  'nameMode', 'fulfillmentMode', 'paymentMode', 'scheduleMode', 'notesMode', 'paymentOptions',
] as const

export async function updateCheckoutAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, CHECKOUT_FIELDS)
  const parsed = checkoutSettingsSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const input = parsed.data

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const { error: vitrineError } = await supabase
    .from('vitrines')
    .update({ cart_enabled: input.cartEnabled, cart_button_text: input.cartButtonText, default_button_text: input.defaultButtonText })
    .eq('id', vitrineId)
  if (vitrineError) return { error: mapDbError(vitrineError), values: fields }

  const { error } = await supabase
    .from('checkout_settings')
    .update({
      name_mode: input.nameMode,
      fulfillment_mode: input.fulfillmentMode,
      payment_mode: input.paymentMode,
      schedule_mode: input.scheduleMode,
      notes_mode: input.notesMode,
      payment_options: input.paymentOptions,
    })
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }

  revalidateVitrine(vitrine.subdomain)
  return { success: 'Mensagens salvas.', values: fields }
}

export async function updateAppearanceAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['theme', 'brandColor'])
  const parsed = appearanceSchema.safeParse({
    theme: fields.theme,
    showPrices: formData.get('showPrices') ?? undefined,
    showMedia: formData.get('showMedia') ?? undefined,
    brandColor: fields.brandColor,
    bannerEnabled: formData.get('bannerEnabled') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }

  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const update = {
    theme: parsed.data.theme,
    show_prices: parsed.data.showPrices,
    show_media: parsed.data.showMedia,
    brand_color: parsed.data.brandColor,
    banner_enabled: parsed.data.bannerEnabled,
  }
  const { error } = await supabase.from('vitrines').update(update).eq('id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Aparência salva.', values: fields }
}

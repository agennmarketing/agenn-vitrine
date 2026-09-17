'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { removeStoredFiles } from '@/lib/media/remove-media'
import { storagePathList } from '@/lib/media/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { appearanceSchema, createVitrineSchema, messagesSchema, subdomainField, vitrineSettingsSchema } from '@/lib/vitrines/schemas'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES } from '@/lib/vitrines/vitrine-types'

const SUBDOMAIN_TAKEN = 'Este endereço já está em uso. Escolha outro.'

export async function createVitrineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['type', 'name', 'subdomain', 'whatsappLabel', 'whatsappPhone', 'theme'])
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
    p_categories: [...SAMPLE_CATEGORIES[input.type]],
  })
  if (error) {
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN }, values: fields }
    return { error: mapDbError(error), values: fields }
  }

  // Limpa um eventual "Vitrine não encontrada" em cache para este endereço.
  revalidateVitrine(input.subdomain)
  redirect(`/painel/vitrines/${vitrineId}/itens`)
}

export async function checkSubdomainAction(value: string, vitrineId?: string): Promise<{ ok: boolean; message: string }> {
  const parsed = subdomainField.safeParse(value)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' }
  const { supabase } = await requireActionUser()
  const { data, error } = await supabase.rpc('is_subdomain_available', {
    p_subdomain: parsed.data,
    p_except_vitrine_id: vitrineId,
  })
  if (error) return { ok: false, message: 'Não foi possível verificar agora.' }
  return data ? { ok: true, message: 'Endereço disponível.' } : { ok: false, message: SUBDOMAIN_TAKEN }
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
    if (error.code === '23505') return { fieldErrors: { subdomain: SUBDOMAIN_TAKEN }, values: fields }
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
  const admin = createSupabaseAdminClient()
  const { data: mediaRows } = await admin.from('media').select('storage_paths').eq('vitrine_id', vitrineId)
  const paths = (mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))
  const { error } = await supabase.from('vitrines').delete().eq('id', vitrineId)
  if (error) return { error: mapDbError(error) }
  await removeStoredFiles(paths)
  revalidateVitrine(vitrine.subdomain)
  redirect('/painel')
}

export async function updateMessagesAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['defaultButtonText'])
  const parsed = messagesSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await loadOwnedVitrine(vitrineId)
  const { error } = await supabase
    .from('vitrines')
    .update({ default_button_text: parsed.data.defaultButtonText })
    .eq('id', vitrineId)
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
  const { data: plan } = await supabase.rpc('my_entitlements')
  // Sem o Pro, os campos de marca ficam desabilitados e não são enviados.
  // Não apagar o que já existe: ao voltar para o Pro, tudo reaparece (spec 4.7).
  const update = {
    theme: parsed.data.theme,
    show_prices: parsed.data.showPrices,
    show_media: parsed.data.showMedia,
    ...(plan?.allow_branding
      ? { brand_color: parsed.data.brandColor, banner_enabled: parsed.data.bannerEnabled }
      : {}),
  }
  const { error } = await supabase.from('vitrines').update(update).eq('id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Aparência salva.', values: fields }
}

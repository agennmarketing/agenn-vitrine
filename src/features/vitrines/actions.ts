'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { createVitrineSchema, subdomainField } from '@/lib/vitrines/schemas'
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

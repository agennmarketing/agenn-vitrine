'use server'

import { redirect } from 'next/navigation'
import { requireActionUser } from '@/lib/auth/action-user'
import { fieldErrorsFromZod, readFormFields, type FormState } from '@/lib/forms/form-state'
import { revalidateVitrine } from '@/lib/vitrines/cache'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { contactSchema } from '@/lib/vitrines/schemas'

async function ownedVitrine(vitrineId: string) {
  const { supabase } = await requireActionUser()
  const { data: vitrine } = await supabase
    .from('vitrines')
    .select('id, subdomain, primary_whatsapp_id')
    .eq('id', vitrineId)
    .maybeSingle()
  if (!vitrine) redirect('/painel')
  return { supabase, vitrine }
}

export async function addContactAction(vitrineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFormFields(formData, ['label', 'phone'])
  const parsed = contactSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { count } = await supabase
    .from('whatsapp_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('vitrine_id', vitrineId)
  const { error } = await supabase
    .from('whatsapp_contacts')
    .insert({ vitrine_id: vitrineId, label: parsed.data.label, phone_e164: parsed.data.phone, position: count ?? 0 })
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato salvo.' }
}

export async function updateContactAction(
  vitrineId: string,
  contactId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFormFields(formData, ['label', 'phone'])
  const parsed = contactSchema.safeParse(fields)
  if (!parsed.success) return { fieldErrors: fieldErrorsFromZod(parsed.error), values: fields }
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase
    .from('whatsapp_contacts')
    .update({ label: parsed.data.label, phone_e164: parsed.data.phone })
    .eq('id', contactId)
    .eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error), values: fields }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato salvo.', values: fields }
}

export async function setPrimaryContactAction(vitrineId: string, contactId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  const { error } = await supabase.from('vitrines').update({ primary_whatsapp_id: contactId }).eq('id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato principal alterado.' }
}

export async function removeContactAction(vitrineId: string, contactId: string): Promise<FormState> {
  const { supabase, vitrine } = await ownedVitrine(vitrineId)
  if (vitrine.primary_whatsapp_id === contactId) {
    return { error: 'Escolha outro contato principal antes de remover este.' }
  }
  // Itens que usavam este contato passam a usar o principal (FK on delete set null).
  const { error } = await supabase.from('whatsapp_contacts').delete().eq('id', contactId).eq('vitrine_id', vitrineId)
  if (error) return { error: mapDbError(error) }
  revalidateVitrine(vitrine.subdomain)
  return { success: 'Contato removido.' }
}

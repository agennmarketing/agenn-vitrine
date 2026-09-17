import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { formatPhone } from '@/lib/whatsapp/phone'
import { Contacts } from './contacts'

export const metadata = { title: 'WhatsApp' }

export default async function WhatsAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const { data: contacts } = await supabase
    .from('whatsapp_contacts')
    .select('id, label, phone_e164')
    .eq('vitrine_id', id)
    .order('position')
    .order('created_at')

  return (
    <Contacts
      vitrineId={id}
      primaryId={vitrine.primary_whatsapp_id}
      contacts={(contacts ?? []).map((contact) => ({
        id: contact.id,
        label: contact.label,
        phone: formatPhone(contact.phone_e164),
      }))}
    />
  )
}

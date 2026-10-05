import { SectionIntro } from '@/components/ui/config-section'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { isAffiliateVitrine } from '@/lib/vitrines/vitrine-types'
import { formatPhone } from '@/lib/whatsapp/phone'
import { DeleteVitrineForm } from './delete-form'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'Configurações' }

export default async function ConfiguracoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  // Serviços não têm a aba WhatsApp: o número principal se troca aqui.
  const servicos = vitrine.type === 'servicos'
  let whatsappPhone = ''
  if (servicos && vitrine.primary_whatsapp_id) {
    const { supabase } = await getPanelSession()
    const { data: contact } = await supabase
      .from('whatsapp_contacts')
      .select('phone_e164')
      .eq('id', vitrine.primary_whatsapp_id)
      .maybeSingle()
    whatsappPhone = contact ? formatPhone(contact.phone_e164) : ''
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro title="Configurações" description="Nome, descrição, contato e o endereço da vitrine." />
      <SettingsForm
        vitrineId={id}
        rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN}
        contact={{ whatsapp: servicos, address: !isAffiliateVitrine(vitrine), hours: servicos }}
        initial={{
          name: vitrine.name,
          description: vitrine.description,
          subdomain: vitrine.subdomain,
          instagram: vitrine.instagram ?? '',
          address: vitrine.address ?? '',
          whatsappPhone,
        }}
      />
      {/* Zona de perigo: separada do resto, no fim da página. */}
      <div className="mt-6 border-t-2 border-dashed border-line-strong pt-8">
        <DeleteVitrineForm vitrineId={id} subdomain={vitrine.subdomain} />
      </div>
    </div>
  )
}

import { SectionIntro } from '@/components/ui/config-section'
import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { DeleteVitrineForm } from './delete-form'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'Configurações' }

export default async function ConfiguracoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro title="Configurações" description="Nome, descrição e o endereço da vitrine." />
      <SettingsForm
        vitrineId={id}
        rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN}
        initial={{ name: vitrine.name, description: vitrine.description, subdomain: vitrine.subdomain }}
      />
      {/* Zona de perigo: separada do resto, no fim da página. */}
      <div className="mt-6 border-t-2 border-dashed border-line-strong pt-8">
        <DeleteVitrineForm vitrineId={id} subdomain={vitrine.subdomain} />
      </div>
    </div>
  )
}

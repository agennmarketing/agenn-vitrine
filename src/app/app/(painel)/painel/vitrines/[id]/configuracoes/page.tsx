import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { DeleteVitrineForm } from './delete-form'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'Configurações' }

export default async function ConfiguracoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  return (
    <div className="flex flex-col gap-6">
      <SettingsForm
        vitrineId={id}
        rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN}
        initial={{ name: vitrine.name, description: vitrine.description, subdomain: vitrine.subdomain }}
      />
      <DeleteVitrineForm vitrineId={id} subdomain={vitrine.subdomain} />
    </div>
  )
}

import { listAddonGroups } from '@/features/addons/queries'
import { getMyVitrine } from '@/features/vitrines/queries'
import { AddonGroups } from './addon-groups'

export const metadata = { title: 'Complementos' }

export default async function ComplementosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getMyVitrine(id)
  const groups = await listAddonGroups(id)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Grupos de complementos podem ser usados em vários itens. Depois de salvar, ligue os grupos no editor de cada item.
      </p>
      <AddonGroups vitrineId={id} groups={groups} />
    </div>
  )
}

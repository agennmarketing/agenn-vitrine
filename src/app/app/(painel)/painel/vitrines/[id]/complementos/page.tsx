import { SectionIntro } from '@/components/ui/config-section'
import { listAddonGroups } from '@/features/addons/queries'
import { getMyVitrine } from '@/features/vitrines/queries'
import { AddonGroups } from './addon-groups'

export const metadata = { title: 'Complementos' }

export default async function ComplementosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getMyVitrine(id)
  const groups = await listAddonGroups(id)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro
        title="Complementos"
        description="Adicionais, ponto da carne, sabores. Um grupo serve para vários itens: depois de salvar, ligue o grupo no editor de cada item."
      />
      <AddonGroups vitrineId={id} groups={groups} />
    </div>
  )
}

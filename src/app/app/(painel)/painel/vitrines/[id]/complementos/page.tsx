import { SectionIntro } from '@/components/ui/config-section'
import { listAddonGroups } from '@/features/addons/queries'
import { getMyVitrine } from '@/features/vitrines/queries'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { AddonGroups } from './addon-groups'

export const metadata = { title: 'Complementos' }

const EXAMPLES: Record<VitrineType, string> = {
  produtos: 'Tamanho, cor, embalagem para presente.',
  servicos: 'Profissional, período, serviços extras.',
  // Vitrines antigas, de quando existia o tipo Comida.
  comida: 'Adicionais, tamanho, opções do item.',
}

export default async function ComplementosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const type = vitrine.type as VitrineType
  const groups = await listAddonGroups(id)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro
        title="Complementos"
        description={`${EXAMPLES[type]} Um grupo serve para vários itens: depois de salvar, ligue o grupo no passo Extras de cada item.`}
      />
      <AddonGroups vitrineId={id} vitrineType={type} groups={groups} />
    </div>
  )
}

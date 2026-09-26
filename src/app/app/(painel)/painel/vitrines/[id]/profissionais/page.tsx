import { redirect } from 'next/navigation'
import { SectionIntro } from '@/components/ui/config-section'
import { listProfessionals } from '@/features/professionals/queries'
import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { Professionals } from './professionals'

export const metadata = { title: 'Profissionais' }

export default async function ProfissionaisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  // Profissionais é coisa de agenda: só a vitrine de serviços tem a seção.
  if (vitrine.type !== 'servicos') redirect(`/painel/vitrines/${id}/itens`)

  const { supabase } = await getPanelSession()
  const [{ data: items, error }, professionals] = await Promise.all([
    supabase
      .from('items')
      .select('id, name')
      .eq('vitrine_id', id)
      .is('deleted_at', null)
      .order('position')
      .order('created_at'),
    listProfessionals(id),
  ])
  if (error) throw error

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro
        title="Profissionais"
        description="Quem atende na sua agenda. Cada um tem os próprios serviços e, se precisar, os próprios horários."
      />
      <Professionals vitrineId={id} services={items ?? []} professionals={professionals} />
    </div>
  )
}

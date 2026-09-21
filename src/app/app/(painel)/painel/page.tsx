import { Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { TypeIcon } from '@/components/ui/type-icon'
import { listMyVitrines } from '@/features/vitrines/queries'

export const metadata = { title: 'Minha vitrine' }

// Uma vitrine por conta: quem já tem vai direto para o editor; quem não tem vê o convite para criar.
export default async function PainelHome() {
  const [vitrine] = await listMyVitrines()
  if (vitrine) redirect(`/painel/vitrines/${vitrine.id}/itens`)

  return (
    <>
      <PanelTopBar title="Minha vitrine" subtitle="Crie sua vitrine" />
      <PanelBody>
        <section className="mx-auto flex max-w-lg animate-rise flex-col items-center gap-5 rounded-card border border-line bg-surface px-6 py-10 text-center sm:mt-6 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="flex items-end gap-2">
            <span className="-rotate-6"><TypeIcon type="servicos" size="lg" /></span>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black tracking-[-0.02em] text-ink">Você ainda não tem vitrine</h2>
            <p className="font-semibold text-ink-muted">
              Em quatro passos sua vitrine fica no ar e as mensagens chegam no seu WhatsApp.
            </p>
          </div>
          <Link href="/painel/vitrines/nova" className={buttonClasses('primary', 'w-full max-w-xs', 'lg')}>
            <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
            Criar minha vitrine
          </Link>
        </section>
      </PanelBody>
    </>
  )
}

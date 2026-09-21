import { Store } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { VitrineWizard } from './wizard'

export const metadata = { title: 'Nova vitrine' }

export default async function NovaVitrinePage() {
  const vitrines = await listMyVitrines()
  // Uma vitrine por conta: quem já tem a sua volta para o painel.
  if (vitrines.length > 0) {
    return (
      <>
        <PanelTopBar back={{ href: '/painel', label: 'Voltar ao painel' }} title="Nova vitrine" />
        <PanelBody>
          <section className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-6 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-card bg-go-soft text-go-strong shadow-[0_4px_0_var(--color-line)]"
            >
              <Store className="size-8" strokeWidth={2.5} />
            </span>
            <h2 className="text-[1.75rem] font-black tracking-[-0.025em]">Você já tem uma vitrine</h2>
            <p className="font-semibold text-ink-muted">Cada conta tem uma vitrine. Edite a sua quando quiser.</p>
            <Link href="/painel" className={buttonClasses('primary', 'w-full', 'lg')}>
              Ir para minha vitrine
            </Link>
          </section>
        </PanelBody>
      </>
    )
  }
  return (
    <PanelBody>
      <VitrineWizard rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN} />
    </PanelBody>
  )
}

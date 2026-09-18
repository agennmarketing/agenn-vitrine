import { Crown } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { getEntitlements, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VitrineWizard } from './wizard'

export const metadata = { title: 'Nova vitrine' }

export default async function NovaVitrinePage() {
  const [vitrines, plan] = await Promise.all([listMyVitrines(), getEntitlements()])
  if (vitrines.length >= plan.max_vitrines) {
    return (
      <>
        <PanelTopBar back={{ href: '/painel', label: 'Voltar para Minhas vitrines' }} title="Nova vitrine" />
        <PanelBody>
          <section className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-6 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-card bg-sun text-sun-ink shadow-[0_4px_0_var(--color-sun-lip)]"
            >
              <Crown className="size-8" strokeWidth={2.5} />
            </span>
            <h2 className="text-[1.75rem] font-black tracking-[-0.025em]">Limite de vitrines</h2>
            <p className="font-semibold text-ink-muted">
              {mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}
            </p>
            <Link href="/painel/plano" className={buttonClasses('sun', 'w-full', 'lg')}>
              Ver o plano Pro
            </Link>
            <Link href="/painel" className={buttonClasses('ghost', 'w-full')}>
              Voltar para Minhas vitrines
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

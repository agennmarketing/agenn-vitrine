import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { getEntitlements, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VitrineWizard } from './wizard'

export const metadata = { title: 'Nova vitrine' }

export default async function NovaVitrinePage() {
  const [vitrines, plan] = await Promise.all([listMyVitrines(), getEntitlements()])
  if (vitrines.length >= plan.max_vitrines) {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold">Nova vitrine</h1>
        <p>{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
        <Link href="/painel/plano" className="underline">
          Ver o plano Pro
        </Link>
        <Link href="/painel" className="underline">
          Voltar para Minhas vitrines
        </Link>
      </Card>
    )
  }
  return <VitrineWizard rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN} />
}

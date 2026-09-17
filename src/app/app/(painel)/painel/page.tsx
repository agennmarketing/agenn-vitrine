import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getEntitlements, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VITRINE_TYPE_LABEL } from '@/lib/vitrines/vitrine-types'
import { CopyLinkButton } from './copy-link-button'

export const metadata = { title: 'Minhas vitrines' }

export default async function PainelHome() {
  const [vitrines, plan] = await Promise.all([listMyVitrines(), getEntitlements()])
  const atLimit = vitrines.length >= plan.max_vitrines

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Minhas vitrines</h1>
        {atLimit ? null : (
          <Link href="/painel/vitrines/nova" className={buttonClasses('primary')}>
            Nova vitrine
          </Link>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Vitrines: {vitrines.length} de {plan.max_vitrines} · Plano {plan.name}
      </p>
      {atLimit ? (
        <Card className="px-5 py-4">
          <p>{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
        </Card>
      ) : null}

      {vitrines.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <h2 className="text-lg font-medium">Você ainda não tem vitrines</h2>
          <p className="max-w-sm text-ink-muted">Crie sua primeira vitrine e receba pedidos pelo WhatsApp.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {vitrines.map((vitrine) => {
            const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
            return (
              <li key={vitrine.id}>
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-medium">{vitrine.name}</h2>
                    <span className="rounded-full bg-subtle px-2 py-0.5 text-xs">
                      {vitrine.status === 'active' ? 'Ativa' : 'Congelada'}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted">{VITRINE_TYPE_LABEL[vitrine.type as keyof typeof VITRINE_TYPE_LABEL]}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm underline">
                    {url.replace(/^https?:\/\//, '')}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <CopyLinkButton url={url} />
                    <Link href={`/painel/vitrines/${vitrine.id}/itens`} className={buttonClasses('primary')}>
                      Editar
                    </Link>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

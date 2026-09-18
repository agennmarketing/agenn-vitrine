import { ExternalLink, Pencil, Plus } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { TypeIcon } from '@/components/ui/type-icon'
import { getEntitlements, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { formatGigabytes } from '@/lib/video/rules'
import { mapDbError } from '@/lib/vitrines/db-errors'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { CopyLinkButton } from './copy-link-button'
import { QrCodeButton } from './qr-code-button'

export const metadata = { title: 'Minhas vitrines' }

export default async function PainelHome() {
  const [vitrines, plan, usage] = await Promise.all([
    listMyVitrines(),
    getEntitlements(),
    getVideoUsage(),
  ])
  const atLimit = vitrines.length >= plan.max_vitrines

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Minhas vitrines"
        actions={
          atLimit || vitrines.length === 0 ? null : (
            <Link href="/painel/vitrines/nova" className={buttonClasses('primary')}>
              <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
              Nova vitrine
            </Link>
          )
        }
      />

      <ul
        aria-label="Uso do plano"
        className="-mx-4 flex gap-2 overflow-x-auto whitespace-nowrap px-4 text-sm font-bold text-ink-muted [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        <li className="shrink-0 rounded-full border-2 border-line bg-surface px-3 py-1.5">
          Vitrines: {vitrines.length} de {plan.max_vitrines}
        </li>
        <li className="shrink-0 rounded-full border-2 border-line bg-surface px-3 py-1.5">
          Vídeos: {usage.videosCount}
          {plan.max_videos_per_account !== null ? ` de ${plan.max_videos_per_account}` : ''}
        </li>
        <li className="shrink-0 rounded-full border-2 border-line bg-surface px-3 py-1.5">
          Franquia do mês: {formatGigabytes(usage.bytesDelivered)} de {plan.monthly_video_gb} GB
        </li>
        <li className="shrink-0 rounded-full border-2 border-line bg-surface px-3 py-1.5">Plano {plan.name}</li>
      </ul>

      {atLimit ? (
        <div className="flex flex-col items-start gap-3 rounded-card border-2 border-sun/60 bg-sun-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-sun-ink">{mapDbError({ message: 'plan_limit:vitrines', hint: String(plan.max_vitrines) })}</p>
          <Link href="/painel/plano" className={buttonClasses('sun', 'shrink-0')}>
            Ver o plano Pro
          </Link>
        </div>
      ) : null}
      {usage.overQuota ? (
        <p role="status" className="rounded-card border-2 border-danger/25 bg-danger-soft p-5 font-bold text-danger">
          A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.
        </p>
      ) : null}

      {vitrines.length === 0 ? (
        <section className="flex flex-col items-center gap-5 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <div aria-hidden="true" className="flex items-end gap-2">
            <span className="-rotate-6"><TypeIcon type="comida" size="lg" /></span>
            <span className="-translate-y-2"><TypeIcon type="servicos" size="lg" /></span>
            <span className="rotate-6"><TypeIcon type="produtos" size="lg" /></span>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black tracking-[-0.02em]">Você ainda não tem vitrines</h2>
            <p className="max-w-sm font-semibold text-ink-muted">
              Em quatro passos sua vitrine fica no ar e os pedidos chegam no seu WhatsApp.
            </p>
          </div>
          {atLimit ? null : (
            <Link href="/painel/vitrines/nova" className={buttonClasses('primary', 'w-full max-w-xs', 'lg')}>
              <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
              Nova vitrine
            </Link>
          )}
        </section>
      ) : (
        <ul className={`grid grid-cols-1 gap-5 ${vitrines.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {vitrines.map((vitrine, index) => {
            const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
            const active = vitrine.status === 'active'
            return (
              <li key={vitrine.id} className="min-w-0 animate-rise" style={{ animationDelay: `${index * 60}ms` }}>
                <article className="overflow-hidden rounded-card border-2 border-line bg-surface">
                  <header className="flex items-center gap-3.5 bg-deep px-5 py-4 text-deep-ink">
                    <TypeIcon type={vitrine.type as VitrineType} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h2 className="truncate text-xl font-black leading-tight tracking-[-0.02em]">{vitrine.name}</h2>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit max-w-full truncate text-sm font-bold text-deep-muted underline decoration-deep-muted/40 hover:text-white"
                      >
                        {url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                    <Badge tone={active ? 'success' : 'sun'}>
                      {active ? 'Ativa' : 'Congelada'}
                    </Badge>
                  </header>

                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <Link href={`/painel/vitrines/${vitrine.id}/itens`} className={buttonClasses('primary', 'w-full', 'lg')}>
                      <Pencil aria-hidden="true" className="size-5" strokeWidth={2.75} />
                      Editar
                    </Link>
                    <div className="grid grid-cols-3 gap-2">
                      <CopyLinkButton url={url} size="tile" className="w-full" />
                      <QrCodeButton url={url} name={vitrine.name} subdomain={vitrine.subdomain} size="tile" className="w-full" />
                      <a href={url} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'w-full', 'tile')}>
                        <ExternalLink aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2.5} />
                        Ver vitrine
                      </a>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

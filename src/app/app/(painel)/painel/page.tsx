import { ArrowRight, Check, ExternalLink, Pencil, Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ProgressBar } from '@/components/ui/progress'
import { TypeIcon } from '@/components/ui/type-icon'
import { getEntitlements, getPanelSession, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { formatGigabytes } from '@/lib/video/rules'
import { mapDbError } from '@/lib/vitrines/db-errors'
import { VITRINE_TYPE_LABEL, type VitrineType } from '@/lib/vitrines/vitrine-types'
import { CopyLinkButton } from './copy-link-button'
import { QrCodeButton } from './qr-code-button'

export const metadata = { title: 'Minhas vitrines' }

const GOAL_ITEMS = 5

type Step = { label: string; done: boolean; href: string; cta: string }

// A trilha de cada vitrine, só com fatos do banco: criada, primeiro item, 5 itens, um vídeo.
function trailFor(vitrineId: string, itemCount: number, videoCount: number): Step[] {
  const base = `/painel/vitrines/${vitrineId}`
  return [
    { label: 'Vitrine criada', done: true, href: base, cta: '' },
    { label: 'Primeiro item', done: itemCount > 0, href: `${base}/itens/novo`, cta: 'Cadastrar o primeiro item' },
    { label: `${GOAL_ITEMS} itens`, done: itemCount >= GOAL_ITEMS, href: `${base}/itens/novo`, cta: `Cadastrar mais itens (${Math.min(itemCount, GOAL_ITEMS)} de ${GOAL_ITEMS})` },
    { label: 'Um vídeo', done: videoCount > 0, href: `${base}/itens`, cta: 'Colocar vídeo em um item' },
  ]
}

export default async function PainelHome() {
  const [vitrines, plan, usage, { supabase }] = await Promise.all([
    listMyVitrines(),
    getEntitlements(),
    getVideoUsage(),
    getPanelSession(),
  ])
  const atLimit = vitrines.length >= plan.max_vitrines

  const ids = vitrines.map((v) => v.id)
  const [{ data: itemRows }, { data: videoRows }] = ids.length
    ? await Promise.all([
        supabase.from('items').select('vitrine_id').in('vitrine_id', ids).is('deleted_at', null),
        supabase.from('media').select('vitrine_id').in('vitrine_id', ids).eq('role', 'video').not('item_id', 'is', null),
      ])
    : [{ data: [] }, { data: [] }]
  const count = (rows: { vitrine_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.vitrine_id === id).length

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
            const steps = trailFor(vitrine.id, count(itemRows, vitrine.id), count(videoRows, vitrine.id))
            const doneCount = steps.filter((s) => s.done).length
            const next = steps.find((s) => !s.done)
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
                    <Badge tone={active ? 'go' : 'sun'}>
                      {active ? 'Ativa' : 'Congelada'}
                    </Badge>
                  </header>

                  <div className="flex flex-col gap-5 p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-extrabold text-ink-muted">
                          {VITRINE_TYPE_LABEL[vitrine.type as VitrineType]} · Sua trilha
                        </p>
                        <p className="numeric text-sm font-black text-go-strong">
                          {doneCount} de {steps.length}
                        </p>
                      </div>
                      <ProgressBar value={doneCount} max={steps.length} label={`Trilha de ${vitrine.name}`} />
                      <ol className="grid grid-cols-4 gap-1">
                        {steps.map((step) => {
                          const current = step === next
                          return (
                            <li key={step.label} className="flex flex-col items-center gap-1.5 text-center">
                              <span
                                className={`flex size-9 items-center justify-center rounded-full border-2 ${
                                  step.done
                                    ? 'border-go-lip bg-go text-go-ink'
                                    : current
                                      ? 'border-go bg-surface text-go-strong ring-4 ring-go/20'
                                      : 'border-line-strong bg-subtle text-ink-muted'
                                }`}
                              >
                                {step.done ? (
                                  <Check aria-hidden="true" className="size-5" strokeWidth={3.5} />
                                ) : (
                                  <span aria-hidden="true" className="size-2.5 rounded-full bg-current" />
                                )}
                              </span>
                              <span className={`text-xs font-extrabold leading-tight ${step.done || current ? 'text-ink' : 'text-ink-muted'}`}>
                                {step.label}
                                <span className="sr-only">{step.done ? ' (feito)' : ' (a fazer)'}</span>
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </div>

                    {next ? (
                      <Link href={next.href} className={buttonClasses('primary', 'w-full justify-between', 'lg')}>
                        <span className="truncate">{next.cta}</span>
                        <ArrowRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={3} />
                      </Link>
                    ) : (
                      <p className="flex items-center gap-3 rounded-control bg-sun-soft px-4 py-3 font-extrabold text-sun-ink">
                        <Sparkles aria-hidden="true" className="size-5 shrink-0 animate-pop text-sun-lip" strokeWidth={2.5} />
                        Trilha completa! Agora é divulgar o link.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/painel/vitrines/${vitrine.id}/itens`} className={buttonClasses('secondary', 'flex-1 sm:flex-none')}>
                        <Pencil aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
                        Editar
                      </Link>
                      <CopyLinkButton url={url} />
                      <QrCodeButton url={url} name={vitrine.name} subdomain={vitrine.subdomain} />
                      <a href={url} target="_blank" rel="noreferrer" className={buttonClasses('ghost', 'px-3')}>
                        <ExternalLink aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
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

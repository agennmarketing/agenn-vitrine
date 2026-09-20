import { ArrowRight, CalendarDays, ExternalLink, Pencil, Play, Plus } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { TypeIcon } from '@/components/ui/type-icon'
import { getEntitlements, getPanelSession, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { ProUpsell } from '../pro-upsell'
import { CopyLinkButton } from './copy-link-button'
import { QrCodeButton } from './qr-code-button'
import { VitrineCardMenu } from './vitrine-card-menu'

export const metadata = { title: 'Minhas vitrines' }

const createdAt = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

// Vídeos de cada vitrine (os que falharam no processamento não contam, como no limite do plano).
async function videoCountByVitrine() {
  const { supabase } = await getPanelSession()
  const { data } = await supabase.from('media').select('vitrine_id').eq('role', 'video').neq('status', 'failed')
  const counts = new Map<string, number>()
  for (const row of data ?? []) counts.set(row.vitrine_id, (counts.get(row.vitrine_id) ?? 0) + 1)
  return counts
}

export default async function PainelHome() {
  const [vitrines, plan, usage, videos] = await Promise.all([
    listMyVitrines(),
    getEntitlements(),
    getVideoUsage(),
    videoCountByVitrine(),
  ])
  const isPro = plan.name !== 'Gratuito'
  // Uma vitrine por conta: sem vitrine, o convite para criar; com vitrine, nenhum botão de nova.

  return (
    <>
      <PanelTopBar
        title="Minhas vitrines"
        subtitle={vitrines.length === 0 ? 'Crie sua vitrine' : 'Sua vitrine'}
      />
      <PanelBody className="flex flex-col gap-6">
        {usage.overQuota ? (
          <p role="status" className="rounded-card border-2 border-danger/25 bg-danger-soft p-5 font-bold text-danger">
            A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.
          </p>
        ) : null}

        {vitrines.length === 0 ? (
          <section className="flex flex-col items-center gap-5 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center">
            <div aria-hidden="true" className="flex items-end gap-2">
              <span className="-rotate-6"><TypeIcon type="produtos" size="lg" /></span>
              <span className="rotate-6"><TypeIcon type="servicos" size="lg" /></span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-black tracking-[-0.02em]">Você ainda não tem vitrine</h2>
              <p className="max-w-sm font-semibold text-ink-muted">
                Em quatro passos sua vitrine fica no ar e as mensagens chegam no seu WhatsApp.
              </p>
            </div>
            <Link href="/painel/vitrines/nova" className={buttonClasses('primary', 'w-full max-w-xs', 'lg')}>
              <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
              Criar minha vitrine
            </Link>
          </section>
        ) : (
          <ul className={`grid grid-cols-1 gap-5 ${vitrines.length > 1 ? 'xl:grid-cols-2' : ''}`}>
            {vitrines.map((vitrine, index) => {
              const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
              const editHref = `/painel/vitrines/${vitrine.id}/itens`
              const active = vitrine.status === 'active'
              const videoCount = videos.get(vitrine.id) ?? 0
              return (
                <li key={vitrine.id} className="min-w-0 animate-rise" style={{ animationDelay: `${index * 60}ms` }}>
                  <article className="flex flex-col gap-5 rounded-card border-2 border-line bg-surface p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                      <Link href={editHref} tabIndex={-1} aria-hidden="true" className="shrink-0">
                        <TypeIcon type={vitrine.type as VitrineType} size="xl" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <h2 className="min-w-0 truncate text-xl font-black leading-tight tracking-[-0.02em] sm:text-[1.375rem]">
                            <Link href={editHref} className="rounded-md hover:text-go-strong">
                              {vitrine.name}
                            </Link>
                          </h2>
                          <Badge tone={active ? 'success' : 'sun'}>
                            <span aria-hidden="true" className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-sun-lip'}`} />
                            {active ? 'Ativa' : 'Congelada'}
                          </Badge>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Abre a vitrine em uma nova aba"
                          className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-md text-[0.9375rem] font-bold text-go-strong underline decoration-go-strong/35 underline-offset-[3px] hover:decoration-go-strong"
                        >
                          <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
                        </a>
                      </div>
                      <VitrineCardMenu vitrineId={vitrine.id} type={vitrine.type as VitrineType} name={vitrine.name} url={url} />
                    </div>
                    {/* No celular as pílulas ocupam a largura toda; a partir de sm alinham com o nome. */}
                    <ul className="-mt-1 flex flex-wrap gap-2 text-[0.8125rem] font-bold text-ink-muted sm:ml-20">
                      <li className="inline-flex h-8 items-center gap-1.5 rounded-full bg-canvas px-3 ring-2 ring-line ring-inset whitespace-nowrap">
                        <Play aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
                        <span className="numeric">
                          {videoCount} {videoCount === 1 ? 'vídeo' : 'vídeos'}
                        </span>
                      </li>
                      <li className="inline-flex h-8 items-center gap-1.5 rounded-full bg-canvas px-3 ring-2 ring-line ring-inset whitespace-nowrap">
                        <CalendarDays aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
                        <span className="numeric">Criada em {createdAt.format(new Date(vitrine.created_at))}</span>
                      </li>
                    </ul>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <CopyLinkButton url={url} size="tile" className="w-full" />
                      <QrCodeButton url={url} name={vitrine.name} subdomain={vitrine.subdomain} size="tile" className="w-full" />
                      <Link href={editHref} className={buttonClasses('primary', 'w-full', 'tile')}>
                        <Pencil aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2.75} />
                        Editar
                        <ArrowRight aria-hidden="true" className="hidden size-[1.125rem] shrink-0 sm:block" strokeWidth={2.75} />
                      </Link>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}

        {isPro ? null : <ProUpsell className="lg:hidden" />}
      </PanelBody>
    </>
  )
}

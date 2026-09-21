import { Check, Crown, Minus, PartyPopper, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { ProgressBar } from '@/components/ui/progress'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { getEntitlements, getPanelSession, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { priceCards } from '@/lib/billing/prices'
import { describeSubscription } from '@/lib/billing/status'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { ActiveVitrineForm } from './active-vitrine-form'
import { PortalForm, SubscribeForm, type SubscribeOption } from './subscribe-form'

export const metadata = { title: 'Plano e assinatura' }

const FALLBACK_LABEL: Record<'month' | 'year', string> = {
  month: 'Assinar o plano mensal',
  year: 'Assinar o plano anual',
}
const INTERVAL_NAME: Record<'month' | 'year', string> = { month: 'Mensal', year: 'Anual' }

type PlanRow = {
  id: string
  max_vitrines: number
  max_items_per_vitrine: number
  max_videos_per_vitrine: number
  max_videos_per_account: number | null
  max_video_seconds: number
  monthly_video_gb: number
  allow_branding: boolean
  show_watermark: boolean
}

type Cell = string | boolean

// A comparação sai inteira da tabela `plans`: nenhum número escrito à mão.
function comparisonRows(free: PlanRow, pro: PlanRow): { label: string; free: Cell; pro: Cell }[] {
  const videos = (plan: PlanRow) =>
    plan.max_videos_per_account !== null
      ? String(plan.max_videos_per_account)
      : String(plan.max_videos_per_vitrine)
  return [
    { label: 'Itens', free: String(free.max_items_per_vitrine), pro: String(pro.max_items_per_vitrine) },
    { label: 'Vídeos', free: videos(free), pro: videos(pro) },
    { label: 'Duração do vídeo', free: `até ${free.max_video_seconds} s`, pro: `até ${pro.max_video_seconds} s` },
    { label: 'Logo, cor da marca e banner', free: free.allow_branding, pro: pro.allow_branding },
    { label: 'Sem marca d’água', free: !free.show_watermark, pro: !pro.show_watermark },
  ]
}

function CellValue({ value, pro }: { value: Cell; pro?: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className={`inline-flex size-7 items-center justify-center rounded-full ${pro ? 'bg-go text-go-ink' : 'bg-go-soft text-go-strong'}`}>
        <Check aria-hidden="true" className="size-4" strokeWidth={3.5} />
        <span className="sr-only">Sim</span>
      </span>
    ) : (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-subtle text-ink-muted">
        <Minus aria-hidden="true" className="size-4" strokeWidth={3} />
        <span className="sr-only">Não</span>
      </span>
    )
  }
  return <span className="numeric">{value}</span>
}

// Um número do uso atual, no mesmo formato para todos: rótulo, valor e (quando há teto) a barra.
function StatTile({ label, value, progress }: { label: string; value: string; progress?: { value: number; max: number } }) {
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line bg-canvas px-4 py-3.5">
      <span className="text-sm font-extrabold text-ink-muted">{label}</span>
      <span className="numeric text-xl font-black leading-tight tracking-[-0.02em] text-ink">{value}</span>
      {progress ? <ProgressBar value={progress.value} max={progress.max} label={label} className="h-2.5" /> : null}
    </div>
  )
}


export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const [{ assinatura }, subscription, plan, vitrines, usage, prices, { supabase }] = await Promise.all([
    searchParams,
    getMySubscription(),
    getEntitlements(),
    listMyVitrines(),
    getVideoUsage(),
    getPlanPrices(),
    getPanelSession(),
  ])
  // Os planos são públicos (leitura liberada pela RLS); se não vierem, a comparação some e o resto continua.
  const { data: planRows } = await supabase
    .from('plans')
    .select(
      'id, max_vitrines, max_items_per_vitrine, max_videos_per_vitrine, max_videos_per_account, max_video_seconds, monthly_video_gb, allow_branding, show_watermark',
    )
    .in('id', ['free', 'pro'])
  const freePlan = planRows?.find((row) => row.id === 'free')
  const proPlan = planRows?.find((row) => row.id === 'pro')

  const summary = describeSubscription(subscription, new Date())
  const cards = priceCards(prices)
  const intervals: ('month' | 'year')[] = ['month', 'year']
  const overLimit = vitrines.length > plan.max_vitrines

  const month = cards.find((card) => card.interval === 'month')
  const options: SubscribeOption[] = intervals.map((interval) => {
    const card = cards.find((item) => item.interval === interval)
    return {
      interval,
      name: INTERVAL_NAME[interval],
      price: card?.title ?? null,
      note: card?.note ?? null,
      label: card ? `Assinar por ${card.title}` : FALLBACK_LABEL[interval],
      highlight: interval === 'year' && Boolean(card && month && card.amountCents < month.amountCents * 12),
    }
  })

  return (
    <>
      <PanelTopBar title="Plano e assinatura" subtitle="Seu plano, o uso e a assinatura" />
      <PanelBody className="flex flex-col gap-6">

      {assinatura === 'ok' ? (
        <p
          role="status"
          className="flex animate-rise items-center gap-3 rounded-card border-2 border-sun/60 bg-sun-soft px-5 py-4 font-extrabold text-sun-ink"
        >
          <PartyPopper aria-hidden="true" className="size-6 shrink-0 animate-pop text-sun-lip" strokeWidth={2.5} />
          {summary.pro ? 'Assinatura confirmada. Bom proveito!' : 'Pagamento recebido. Em instantes o Pro aparece aqui.'}
        </p>
      ) : null}

      {/* 1. Plano atual e o uso, em dois números alinhados. */}
      <section aria-labelledby="plano-atual" className="overflow-hidden rounded-card border border-line bg-surface">
        <header className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-control ${
                summary.pro ? 'bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]' : 'bg-go-soft text-go-strong'
              }`}
            >
              {summary.pro ? <Crown className="size-6" strokeWidth={2.5} /> : <Sparkles className="size-6" strokeWidth={2.5} />}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="plano-atual" className="text-2xl font-black leading-tight tracking-[-0.02em] text-go-strong">
                {summary.title}
              </h2>
              <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{summary.detail}</p>
            </div>
          </div>
          {summary.showPortal ? <PortalForm /> : null}
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <StatTile
            label="Vídeos"
            value={plan.max_videos_per_account !== null ? `${usage.videosCount} de ${plan.max_videos_per_account}` : String(usage.videosCount)}
            progress={plan.max_videos_per_account !== null ? { value: usage.videosCount, max: plan.max_videos_per_account } : undefined}
          />
          <StatTile label="Itens" value={`até ${plan.max_items_per_vitrine}`} />
        </div>
      </section>

      {/* 2. Assinar: à esquerda o que muda, à direita a cobrança e o botão. */}
      {summary.showSubscribe || (freePlan && proPlan) ? (
        <section
          aria-labelledby="assinar-pro"
          className={`grid overflow-hidden rounded-card bg-surface ${
            summary.showSubscribe ? 'border-2 border-sun/70 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]' : 'border border-line'
          }`}
        >
          {freePlan && proPlan ? (
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <h2 id={summary.showSubscribe ? undefined : 'assinar-pro'} className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
                Gratuito × Pro
              </h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="w-[44%] pb-3 text-left">
                      <span className="sr-only">Recurso</span>
                    </th>
                    <th scope="col" className="pb-3 text-center align-bottom">
                      <span className="flex flex-col items-center gap-1 font-extrabold text-ink-muted">
                        Gratuito
                        {summary.pro ? null : <Badge className="h-5 px-2 text-[0.6875rem]">Seu plano</Badge>}
                      </span>
                    </th>
                    <th scope="col" className="rounded-t-control bg-sun-soft/60 pb-3 pt-2 text-center align-bottom">
                      <span className="flex flex-col items-center gap-1 font-black text-ink">
                        <span className="inline-flex items-center gap-1">
                          <Crown aria-hidden="true" className="size-4 text-sun-lip" strokeWidth={2.75} />
                          Pro
                        </span>
                        {summary.pro ? <Badge tone="sun" className="h-5 px-2 text-[0.6875rem]">Seu plano</Badge> : null}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows(freePlan, proPlan).map((row) => (
                    <tr key={row.label} className="border-t border-line">
                      <th scope="row" className="py-3 pr-2 text-left font-extrabold leading-snug text-ink">
                        {row.label}
                      </th>
                      <td className="px-1 py-3 text-center font-bold text-ink-muted">
                        <CellValue value={row.free} />
                      </td>
                      <td className="bg-sun-soft/60 px-1 py-3 text-center font-black text-ink">
                        <CellValue value={row.pro} pro />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {summary.showSubscribe ? (
            <div className="flex min-w-0 flex-col gap-5 border-t border-sun/40 bg-sun-soft/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-control bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]"
                >
                  <Crown className="size-6" strokeWidth={2.5} />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 id="assinar-pro" className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
                    Assinar o Pro
                  </h2>
                  <p className="text-[0.9375rem] font-semibold text-ink-muted">
                    Pagamento no cartão, pelo Stripe. Cancele quando quiser.
                  </p>
                </div>
              </div>
              <SubscribeForm options={options} />
            </div>
          ) : null}
        </section>
      ) : null}

      {overLimit ? (
        <Card>
          <ActiveVitrineForm
            vitrines={vitrines.map((vitrine) => ({
              id: vitrine.id,
              name: vitrine.name,
              status: vitrine.status,
              type: vitrine.type as VitrineType,
            }))}
            maxVitrines={plan.max_vitrines}
          />
        </Card>
      ) : null}
      </PanelBody>
    </>
  )
}

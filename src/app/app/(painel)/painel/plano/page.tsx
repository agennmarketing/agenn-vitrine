import { Check, Crown, Minus, PartyPopper, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { ProgressBar } from '@/components/ui/progress'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { getEntitlements, getPanelSession, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { priceCards } from '@/lib/billing/prices'
import { describeSubscription } from '@/lib/billing/status'
import { formatGigabytes } from '@/lib/video/rules'
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
      ? `${plan.max_videos_per_account} na conta`
      : `${plan.max_videos_per_vitrine} por vitrine`
  return [
    { label: 'Itens por vitrine', free: String(free.max_items_per_vitrine), pro: String(pro.max_items_per_vitrine) },
    { label: 'Vídeos', free: videos(free), pro: videos(pro) },
    { label: 'Duração do vídeo', free: `até ${free.max_video_seconds} s`, pro: `até ${pro.max_video_seconds} s` },
    { label: 'Franquia de vídeo', free: `${free.monthly_video_gb} GB/mês`, pro: `${pro.monthly_video_gb} GB/mês` },
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

function UsageRow({ label, value, max }: { label: string; value: number; max: number | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-extrabold text-ink">{label}</span>
        <span className="numeric font-black text-ink-muted">
          {value}
          {max !== null ? ` de ${max}` : ''}
        </span>
      </div>
      {max !== null ? <ProgressBar value={value} max={max} label={label} className="h-3" /> : null}
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Plano atual: placa verde-escura; no Pro ganha a coroa dourada. */}
        <section className="overflow-hidden rounded-card border-2 border-line bg-surface">
          <header className="flex items-start gap-4 bg-deep px-5 py-5 text-deep-ink sm:px-6">
            <span
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-control ${
                summary.pro ? 'bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]' : 'bg-deep-raised text-deep-muted'
              }`}
            >
              {summary.pro ? <Crown className="size-6" strokeWidth={2.5} /> : <Sparkles className="size-6" strokeWidth={2.5} />}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-2xl font-black leading-tight tracking-[-0.02em]">{summary.title}</h2>
              <p className="text-[0.9375rem] font-semibold leading-snug text-deep-muted">{summary.detail}</p>
            </div>
          </header>
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageRow label="Vídeos" value={usage.videosCount} max={plan.max_videos_per_account} />
            </div>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-t-2 border-line pt-3 sm:block">
                <dt className="font-extrabold text-ink">Itens por vitrine</dt>
                <dd className="numeric font-bold text-ink-muted">até {plan.max_items_per_vitrine}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t-2 border-line pt-3 sm:block">
                <dt className="font-extrabold text-ink">Franquia do mês</dt>
                <dd className="numeric font-bold text-ink-muted">
                  {formatGigabytes(usage.bytesDelivered)} de {plan.monthly_video_gb} GB
                </dd>
              </div>
            </dl>
            {summary.showPortal ? <PortalForm /> : null}
          </div>
        </section>

        {freePlan && proPlan ? (
          <section aria-labelledby="comparacao" className="rounded-card border-2 border-line bg-surface p-5 sm:p-6">
            <h2 id="comparacao" className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
              Gratuito × Pro
            </h2>
            <table className="mt-4 w-full border-collapse text-sm">
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
                  <th scope="col" className="pb-3 text-center align-bottom">
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
                  <tr key={row.label} className="border-t-2 border-line">
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
          </section>
        ) : null}
      </div>

      {summary.showSubscribe ? (
        <section className="flex min-w-0 flex-col gap-5 rounded-card border-2 border-sun/70 bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-control bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]"
            >
              <Crown className="size-6" strokeWidth={2.5} />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">Assinar o Pro</h2>
              <p className="text-[0.9375rem] font-semibold text-ink-muted">
                Pagamento no cartão, pelo Stripe. Cancele quando quiser.
              </p>
            </div>
          </div>
          <SubscribeForm options={options} />
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

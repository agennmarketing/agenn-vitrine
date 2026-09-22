import { Check, Clock, Crown, Lock, PartyPopper } from 'lucide-react'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { ProgressBar } from '@/components/ui/progress'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { getEntitlements, getPanelSession, getVideoUsage } from '@/features/vitrines/queries'
import { monthlyPriceLabel } from '@/lib/billing/prices'
import { describeSubscription, PLAN_NAME } from '@/lib/billing/status'
import { PortalForm, SubscribeForm } from './subscribe-form'

export const metadata = { title: 'Plano e assinatura' }

type PlanRow = {
  max_items_per_vitrine: number
  max_videos_per_vitrine: number
  max_videos_per_account: number | null
  max_video_seconds: number
}

// O que o Essencial inclui; os números saem da tabela `plans`.
function features(plan: PlanRow | null): string[] {
  const list = ['Vitrine de serviços com link próprio', 'Agenda online: seus clientes marcam o horário sozinhos']
  if (plan) {
    const videos = plan.max_videos_per_account ?? plan.max_videos_per_vitrine
    list.push(`Até ${plan.max_items_per_vitrine} serviços e ${videos} vídeos de até ${plan.max_video_seconds} s`)
  }
  list.push('Logo, cor da marca e banner')
  return list
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
  const [{ assinatura }, subscription, plan, usage, prices, { supabase }] = await Promise.all([
    searchParams,
    getMySubscription(),
    getEntitlements(),
    getVideoUsage(),
    getPlanPrices(),
    getPanelSession(),
  ])
  // Os planos são públicos (leitura liberada pela RLS); se não vier, a lista fica sem os números.
  const { data: essencial } = await supabase
    .from('plans')
    .select('max_items_per_vitrine, max_videos_per_vitrine, max_videos_per_account, max_video_seconds')
    .eq('id', 'essencial')
    .maybeSingle()

  const summary = describeSubscription(subscription, new Date())
  const { access } = summary
  const priceLabel = monthlyPriceLabel(prices)
  const Icon = access.status === 'active' ? Crown : access.status === 'trialing' ? Clock : Lock

  return (
    <>
      <PanelTopBar title="Plano e assinatura" subtitle={`${PLAN_NAME} · ${priceLabel}`} />
      <PanelBody className="flex flex-col gap-6">

      {assinatura === 'ok' ? (
        <p
          role="status"
          className="flex animate-rise items-center gap-3 rounded-card border-2 border-sun/60 bg-sun-soft px-5 py-4 font-extrabold text-sun-ink"
        >
          <PartyPopper aria-hidden="true" className="size-6 shrink-0 animate-pop text-sun-lip" strokeWidth={2.5} />
          {access.status === 'active'
            ? 'Assinatura confirmada. Bom proveito!'
            : 'Pagamento recebido. Em instantes a assinatura aparece aqui.'}
        </p>
      ) : null}

      {/* 1. Situação da conta e, com acesso, o uso. */}
      <section aria-labelledby="plano-atual" className="overflow-hidden rounded-card border border-line bg-surface">
        <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-control ${
                access.status === 'active' ? 'bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]' : 'bg-go-soft text-go-strong'
              }`}
            >
              <Icon className="size-6" strokeWidth={2.5} />
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
        {access.hasAccess ? (
          <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-2 sm:p-6">
            <StatTile
              label="Vídeos"
              value={plan.max_videos_per_account !== null ? `${usage.videosCount} de ${plan.max_videos_per_account}` : String(usage.videosCount)}
              progress={plan.max_videos_per_account !== null ? { value: usage.videosCount, max: plan.max_videos_per_account } : undefined}
            />
            <StatTile label="Serviços" value={`até ${plan.max_items_per_vitrine}`} />
          </div>
        ) : null}
      </section>

      {/* 2. Assinar: o que o plano inclui e o botão com o preço. */}
      {summary.showSubscribe ? (
        <section
          aria-labelledby="assinar-plano"
          className="grid overflow-hidden rounded-card border-2 border-sun/70 bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        >
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 id="assinar-plano" className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
              {PLAN_NAME}
            </h2>
            <ul className="flex flex-col gap-3">
              {features(essencial).map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-[0.9375rem] font-bold leading-snug text-ink">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-go text-go-ink">
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={3.5} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-4 border-t border-sun/40 bg-sun-soft/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="numeric text-3xl font-black tracking-[-0.02em] text-ink">{priceLabel}</p>
            <p className="text-[0.9375rem] font-semibold text-ink-muted">
              Pagamento no cartão, pelo Stripe. Cancele quando quiser.
            </p>
            <SubscribeForm priceLabel={priceLabel} />
          </div>
        </section>
      ) : null}
      </PanelBody>
    </>
  )
}

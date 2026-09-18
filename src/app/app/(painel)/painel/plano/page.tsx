import { Card } from '@/components/ui/card'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { getEntitlements, getVideoUsage, listMyVitrines } from '@/features/vitrines/queries'
import { priceCards } from '@/lib/billing/prices'
import { describeSubscription } from '@/lib/billing/status'
import { formatGigabytes } from '@/lib/video/rules'
import { ActiveVitrineForm } from './active-vitrine-form'
import { PortalForm, SubscribeForm } from './subscribe-form'

export const metadata = { title: 'Plano e assinatura' }

const FALLBACK_LABEL: Record<'month' | 'year', string> = {
  month: 'Assinar o plano mensal',
  year: 'Assinar o plano anual',
}

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const [{ assinatura }, subscription, plan, vitrines, usage, prices] = await Promise.all([
    searchParams,
    getMySubscription(),
    getEntitlements(),
    listMyVitrines(),
    getVideoUsage(),
    getPlanPrices(),
  ])

  const summary = describeSubscription(subscription, new Date())
  const cards = priceCards(prices)
  const intervals: ('month' | 'year')[] = ['month', 'year']
  const overLimit = vitrines.length > plan.max_vitrines

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Plano e assinatura</h1>

      {assinatura === 'ok' ? (
        <Card className="px-5 py-4">
          <p>
            {summary.pro
              ? 'Assinatura confirmada. Bom proveito!'
              : 'Pagamento recebido. Em instantes o Pro aparece aqui.'}
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 px-5 py-4">
        <h2 className="text-lg font-medium">{summary.title}</h2>
        <p className="text-ink-muted">{summary.detail}</p>
        <p className="text-sm text-ink-muted">
          Vitrines: {vitrines.length} de {plan.max_vitrines} · Itens por vitrine: até {plan.max_items_per_vitrine} ·
          Vídeos: {usage.videosCount}
          {plan.max_videos_per_account !== null ? ` de ${plan.max_videos_per_account}` : ''} · Franquia do mês:{' '}
          {formatGigabytes(usage.bytesDelivered)} de {plan.monthly_video_gb} GB
        </p>
        {summary.showPortal ? <PortalForm /> : null}
      </Card>

      {summary.showSubscribe ? (
        <Card className="flex flex-col gap-4 px-5 py-4">
          <div>
            <h2 className="text-lg font-medium">Assinar o Pro</h2>
            <p className="text-sm text-ink-muted">Pagamento no cartão, pelo Stripe. Cancele quando quiser.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {intervals.map((interval) => {
              const card = cards.find((item) => item.interval === interval)
              return (
                <div key={interval} className="flex flex-col gap-2 rounded-control bg-subtle p-4">
                  <p className="font-medium">{card?.title ?? FALLBACK_LABEL[interval]}</p>
                  {card ? <p className="text-sm text-ink-muted">{card.note}</p> : null}
                  <SubscribeForm
                    interval={interval}
                    label={card ? `Assinar por ${card.title}` : FALLBACK_LABEL[interval]}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      {overLimit ? (
        <Card className="px-5 py-4">
          <ActiveVitrineForm
            vitrines={vitrines.map((vitrine) => ({ id: vitrine.id, name: vitrine.name, status: vitrine.status }))}
            maxVitrines={plan.max_vitrines}
          />
        </Card>
      ) : null}
    </div>
  )
}

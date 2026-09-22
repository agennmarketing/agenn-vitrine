import { Check, Clock, Crown, Lock, PartyPopper } from 'lucide-react'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { getMySubscription, getPlanPrices } from '@/features/billing/queries'
import { monthlyPriceLabel, monthlyPriceShort } from '@/lib/billing/prices'
import { describeSubscription } from '@/lib/billing/status'
import { PortalForm, SubscribeForm } from './subscribe-form'

export const metadata = { title: 'Plano e assinatura' }

// O que o Essencial inclui.
const FEATURES = [
  '1 vitrine',
  'Serviços ilimitados',
  'Fotos',
  'Agenda online',
  'Agendamentos',
  'Personalização',
  'Notificações do painel',
]

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const [{ assinatura }, subscription, prices] = await Promise.all([searchParams, getMySubscription(), getPlanPrices()])

  const summary = describeSubscription(subscription, new Date())
  const { access } = summary
  const priceLabel = monthlyPriceLabel(prices)
  const priceShort = monthlyPriceShort(prices)
  const Icon = access.status === 'active' ? Crown : access.status === 'trialing' ? Clock : Lock

  return (
    <>
      <PanelTopBar title="Plano e assinatura" subtitle={`Essencial · ${priceShort}`} />
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

      {/* 1. Situação da conta: teste, assinatura ativa ou sem acesso. */}
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
      </section>

      {/* 2. O plano: o que inclui, o preço e, sem assinatura, o botão de assinar. */}
      <section
        aria-labelledby="plano-essencial"
        className="grid overflow-hidden rounded-card border-2 border-sun/70 bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="plano-essencial" className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
            Essencial
          </h2>
          <ul className="flex flex-col gap-3">
            {FEATURES.map((feature) => (
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
          <p className="numeric text-3xl font-black tracking-[-0.02em] text-ink">{priceShort}</p>
          <p className="text-[0.9375rem] font-semibold text-ink-muted">
            Pagamento no cartão, pelo Stripe. Cancele quando quiser.
          </p>
          {summary.showSubscribe ? (
            <SubscribeForm
              priceLabel={priceLabel}
              label={access.status === 'trialing' ? 'Assinar Essencial' : `Assinar por ${priceShort}`}
            />
          ) : null}
        </div>
      </section>
      </PanelBody>
    </>
  )
}

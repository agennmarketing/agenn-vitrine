import { Lock } from 'lucide-react'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { PLAN_NAME, type AccountStatus } from '@/lib/billing/status'
import { SubscribeForm } from './painel/plano/subscribe-form'

// Tela de assinatura no lugar do painel quando o teste acaba (ou a assinatura é
// cancelada) sem pagamento. Nada foi apagado: assinar libera tudo na hora.
export function AccessWall({ status, priceLabel }: { status: AccountStatus; priceLabel: string }) {
  const title = status === 'canceled' ? 'Sua assinatura foi cancelada' : 'Seu teste grátis terminou'
  return (
    <>
      <PanelTopBar title="Assine para continuar" subtitle={PLAN_NAME} />
      <PanelBody>
        <section
          aria-labelledby="assinatura-necessaria"
          className="mx-auto flex max-w-xl flex-col items-start gap-5 rounded-card border-2 border-sun/70 bg-surface p-6 sm:p-8"
        >
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-control bg-sun text-sun-ink shadow-[0_3px_0_var(--color-sun-lip)]"
          >
            <Lock className="size-6" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col gap-2">
            <h2 id="assinatura-necessaria" className="text-2xl font-black leading-tight tracking-[-0.02em] text-ink">
              {title}
            </h2>
            <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">
              Sua vitrine, seus serviços e sua agenda continuam guardados. Assine o {PLAN_NAME} e tudo volta a
              funcionar na hora, inclusive os agendamentos pela vitrine.
            </p>
          </div>
          <SubscribeForm priceLabel={priceLabel} className="w-full" />
          <p className="text-sm font-semibold text-ink-muted">Pagamento no cartão, pelo Stripe. Cancele quando quiser.</p>
        </section>
      </PanelBody>
    </>
  )
}

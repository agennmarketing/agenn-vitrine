'use client'

import { ArrowRight, ExternalLink } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChoiceCard } from '@/components/ui/choice-card'
import { FormMessage } from '@/components/ui/form-message'
import { Spinner } from '@/components/ui/submit-button'
import { openPortalAction, startCheckoutAction, type BillingRedirectState } from '@/features/billing/actions'

// Navegação de verdade para o Stripe (ou para a rota que faz o papel dele nos testes):
// um `redirect()` de Server Action para o mesmo domínio viraria navegação do roteador.
function useBillingRedirect(url: string | undefined) {
  useEffect(() => {
    if (url) window.location.assign(url)
  }, [url])
}

const EMPTY: BillingRedirectState = {}

export type SubscribeOption = {
  interval: 'month' | 'year'
  /** "Mensal" / "Anual". */
  name: string
  /** Preço por extenso ("R$ 149,90 por mês"), quando o preço veio do Stripe. */
  price: string | null
  note: string | null
  /** Rótulo do botão de assinar quando esta opção está marcada. */
  label: string
  highlight: boolean
}

// Mensal × anual como opções grandes; o próprio rádio envia o campo `interval` da ação.
export function SubscribeForm({ options }: { options: SubscribeOption[] }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, EMPTY)
  const [interval, setChosen] = useState<'month' | 'year'>(options[0]?.interval ?? 'month')
  useBillingRedirect(state.url)
  const busy = pending || Boolean(state.url)
  const selected = options.find((option) => option.interval === interval) ?? options[0]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Forma de cobrança</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <ChoiceCard
              key={option.interval}
              name="interval"
              value={option.interval}
              checked={interval === option.interval}
              onChange={() => setChosen(option.interval)}
              aria-label={option.price ? `${option.name}: ${option.price}` : option.name}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {option.name}
                  {option.highlight ? <Badge tone="sun">Mais econômico</Badge> : null}
                </span>
              }
              description={
                <span className="flex flex-col gap-1">
                  {option.price ? (
                    <span className="numeric text-xl font-black tracking-[-0.02em] text-ink">{option.price}</span>
                  ) : null}
                  {option.note ? <span>{option.note}</span> : null}
                </span>
              }
            />
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="sun" size="lg" disabled={busy} aria-busy={busy} className="w-full sm:w-auto sm:self-start">
        {busy ? <Spinner /> : null}
        {selected?.label}
        {busy ? null : <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />}
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

export function PortalForm() {
  const [state, formAction, pending] = useActionState(openPortalAction, EMPTY)
  useBillingRedirect(state.url)
  const busy = pending || Boolean(state.url)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy} className="w-full sm:w-auto sm:self-start">
        {busy ? <Spinner /> : <ExternalLink aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />}
        Gerenciar assinatura
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

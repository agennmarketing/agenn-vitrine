'use client'

import { ArrowRight, ExternalLink } from 'lucide-react'
import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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

// Um plano, uma cobrança: o botão já diz o preço ("Assinar por R$ 79,90 por mês"), a não ser que venha outro rótulo.
export function SubscribeForm({
  priceLabel,
  label,
  className = '',
}: {
  priceLabel: string
  label?: string
  className?: string
}) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, EMPTY)
  useBillingRedirect(state.url)
  const busy = pending || Boolean(state.url)

  return (
    <form action={formAction} className={`flex flex-col gap-3 ${className}`}>
      <Button type="submit" variant="sun" size="lg" disabled={busy} aria-busy={busy} className="w-full sm:w-auto">
        {busy ? <Spinner /> : null}
        {label ?? `Assinar por ${priceLabel}`}
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

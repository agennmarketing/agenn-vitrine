'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { openPortalAction, startCheckoutAction, type BillingRedirectState } from '@/features/billing/actions'

// Navegação de verdade para o Stripe (ou para a rota que faz o papel dele nos testes):
// um `redirect()` de Server Action para o mesmo domínio viraria navegação do roteador.
function useBillingRedirect(url: string | undefined) {
  useEffect(() => {
    if (url) window.location.assign(url)
  }, [url])
}

const EMPTY: BillingRedirectState = {}

export function SubscribeForm({ interval, label }: { interval: 'month' | 'year'; label: string }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, EMPTY)
  useBillingRedirect(state.url)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" disabled={pending || Boolean(state.url)} aria-busy={pending || Boolean(state.url)}>
        {label}
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

export function PortalForm() {
  const [state, formAction, pending] = useActionState(openPortalAction, EMPTY)
  useBillingRedirect(state.url)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || Boolean(state.url)}
        aria-busy={pending || Boolean(state.url)}
        className="self-start"
      >
        Gerenciar assinatura
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

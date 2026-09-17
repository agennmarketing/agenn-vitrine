'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { openPortalAction, startCheckoutAction } from '@/features/billing/actions'

export function SubscribeForm({ interval, label }: { interval: 'month' | 'year'; label: string }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, {})
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {label}
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

export function PortalForm() {
  const [state, formAction, pending] = useActionState(openPortalAction, {})
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending} className="self-start">
        Gerenciar assinatura
      </Button>
      <FormMessage error={state.error} />
    </form>
  )
}

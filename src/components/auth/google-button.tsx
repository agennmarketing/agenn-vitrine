'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/submit-button'
import { env } from '@/lib/env'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export function GoogleButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false)
  if (!env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED) return null

  async function handleClick() {
    setPending(true)
    const supabase = createSupabaseBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? '/painel')}`
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) setPending(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" size="lg" className="w-full" onClick={handleClick} disabled={pending} aria-busy={pending}>
        {pending ? <Spinner className="size-[18px]" /> : null}
        <svg aria-hidden="true" viewBox="0 0 18 18" className={`size-[18px] shrink-0 ${pending ? 'hidden' : ''}`}>
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.94v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.05l3.02-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .94 4.95l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        Continuar com Google
      </Button>
      {/* O separador só aparece junto com o botão (sem Google configurado, nenhum dos dois existe). */}
      <div aria-hidden="true" className="flex items-center gap-3 text-sm font-extrabold text-ink-muted">
        <span className="h-0.5 flex-1 rounded-full bg-line" />
        ou com e-mail
        <span className="h-0.5 flex-1 rounded-full bg-line" />
      </div>
    </div>
  )
}

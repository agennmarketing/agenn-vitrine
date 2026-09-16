'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    <Button variant="secondary" className="w-full" onClick={handleClick} disabled={pending}>
      Continuar com Google
    </Button>
  )
}

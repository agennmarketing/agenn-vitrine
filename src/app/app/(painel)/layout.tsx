import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/features/auth/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PainelLayout({ children }: { children: ReactNode }) {
  // O proxy já confirmou a sessão (session_state); aqui basta o JWT validado localmente.
  const supabase = await createSupabaseServerClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (typeof claims?.sub !== 'string') redirect('/entrar')
  const userId = claims.sub
  const email = typeof claims.email === 'string' ? claims.email : ''

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', userId).single(),
    supabase.rpc('my_entitlements'),
  ])
  const displayName = profile?.name || email

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
          <Link href="/painel" className="flex shrink-0 items-center gap-2 font-semibold">
            <Image src="/brand/logo-icone-512.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" />
            <span className="hidden sm:inline">Agenn Vitrine</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/painel" className="rounded-control px-3 py-2 hover:bg-canvas">
              Vitrines
            </Link>
            <Link href="/painel/conta" className="rounded-control px-3 py-2 hover:bg-canvas">
              Conta
            </Link>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Único acesso a Conta no celular, onde a navegação fica escondida. */}
            <Link
              href="/painel/conta"
              aria-label={`Conta de ${displayName}`}
              className="flex min-w-0 flex-col items-end rounded-control px-2 py-1 leading-tight hover:bg-canvas"
            >
              <span className="max-w-[8rem] truncate text-sm font-medium sm:max-w-[10rem]">{displayName}</span>
              <span className="text-xs text-ink-muted">Plano {plan?.name ?? 'Gratuito'}</span>
            </Link>
            <form action={signOutAction} className="shrink-0">
              <Button type="submit" variant="ghost">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { signOutAction } from '@/features/auth/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BottomNav, SideNav } from './painel-nav'
import { ProUpsell } from './pro-upsell'
import { LogoMark, Wordmark } from '@/components/brand/logo'

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
  const planName = plan?.name ?? 'Gratuito'
  const isPro = planName !== 'Gratuito'

  return (
    // Modo foco (assistente de nova vitrine marca data-focus-mode): some a navegação, fica só a trilha.
    // Cada página desenha o próprio cabeçalho índigo (PanelTopBar) com o nome da seção.
    <div className="group/shell min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:has-[[data-focus-mode]]:grid-cols-1">
      <aside className="sticky top-0 hidden group-has-[[data-focus-mode]]/shell:!hidden h-dvh flex-col gap-8 overflow-y-auto border-r-2 border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/painel" className="flex items-center gap-2.5 px-2">
          <LogoMark size={44} />
          <Wordmark className="text-xl" />
        </Link>
        <SideNav />

        <div className="mt-auto flex flex-col gap-4">
          {isPro ? null : <ProUpsell />}
          <div className="flex items-center gap-2.5 border-t-2 border-line pt-4">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-deep text-[0.9375rem] font-black text-deep-ink"
            >
              {displayName.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <Link
                href="/painel/conta"
                aria-label={`Conta de ${displayName}`}
                className="max-w-full truncate rounded-md text-sm font-extrabold text-ink hover:text-go-strong"
              >
                {displayName}
              </Link>
              {/* Link separado: um <a> dentro de outro seria HTML inválido. */}
              <Link href="/painel/plano" className="-my-1 inline-flex min-h-7 items-center rounded-md py-1">
                <Badge tone={isPro ? 'sun' : 'neutral'} className="mt-0.5 h-5 px-2 text-[0.6875rem]">
                  Plano {planName}
                </Badge>
              </Link>
            </div>
            <form action={signOutAction} className="shrink-0">
              <button
                type="submit"
                aria-label="Sair"
                title="Sair"
                className="flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
              >
                <LogOut aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col pb-40 group-has-[[data-focus-mode]]/shell:pb-10 lg:pb-16">{children}</main>

      <BottomNav />
    </div>
  )
}

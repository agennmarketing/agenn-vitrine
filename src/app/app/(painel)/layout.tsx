import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { signOutAction } from '@/features/auth/actions'
import { getPlanPrices } from '@/features/billing/queries'
import { monthlyPriceLabel } from '@/lib/billing/prices'
import { accessFor, trialNotice, type Access } from '@/lib/billing/status'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AccessGate } from './access-gate'
import { AccessWall } from './access-wall'
import { InstallApp } from './install-app'
import { BottomNav, SideNav } from './painel-nav'
import { TrialBanner } from './trial-banner'
import { LogoMark, Wordmark } from '@/components/brand/logo'

const BADGE: Record<Access['status'], { label: string; tone: 'sun' | 'neutral' | 'danger' }> = {
  active: { label: 'Plano Essencial', tone: 'sun' },
  trialing: { label: 'Teste grátis', tone: 'neutral' },
  expired: { label: 'Teste encerrado', tone: 'danger' },
  canceled: { label: 'Assinatura cancelada', tone: 'danger' },
}

export default async function PainelLayout({ children }: { children: ReactNode }) {
  // O proxy já confirmou a sessão (session_state); aqui basta o JWT validado localmente.
  const supabase = await createSupabaseServerClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (typeof claims?.sub !== 'string') redirect('/entrar')
  const userId = claims.sub
  const email = typeof claims.email === 'string' ? claims.email : ''

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', userId).single(),
    supabase
      .from('subscriptions')
      .select('status, grace_until, trial_ends_at, subscription_status')
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  const displayName = profile?.name || email
  const access = accessFor(subscription, new Date())
  const notice = trialNotice(access)
  const priceLabel = access.hasAccess ? '' : monthlyPriceLabel(await getPlanPrices())

  return (
    // Modo foco (assistente de nova vitrine marca data-focus-mode): some a navegação, fica só a trilha.
    // Cada página desenha o próprio cabeçalho (PanelTopBar) com o nome da seção.
    <div className="group/shell min-h-dvh lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:has-[[data-focus-mode]]:grid-cols-1">
      <aside className="sticky top-0 hidden group-has-[[data-focus-mode]]/shell:!hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/painel" className="flex h-12 items-center gap-2 px-2.5">
          <LogoMark size={34} />
          <Wordmark className="text-lg" />
        </Link>
        <SideNav />

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-center gap-2.5 border-t border-line px-1 pt-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-go-soft text-sm font-black text-go-strong"
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
                <Badge tone={BADGE[access.status].tone} className="mt-0.5 h-5 px-2 text-[0.6875rem]">
                  {BADGE[access.status].label}
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

      <main className="flex min-w-0 flex-col pb-40 group-has-[[data-focus-mode]]/shell:pb-10 lg:pb-16">
        {notice ? <TrialBanner message={notice} /> : null}
        <InstallApp />
        <AccessGate blocked={!access.hasAccess} wall={<AccessWall status={access.status} priceLabel={priceLabel} />}>
          {children}
        </AccessGate>
      </main>

      <BottomNav />
    </div>
  )
}

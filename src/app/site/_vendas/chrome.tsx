import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { LogoMark, Wordmark } from '@/components/brand/logo'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import { COMPANY } from '@/lib/legal/company'
import { PERSONAS } from './personas'

export function appLinks() {
  return {
    signupUrl: buildAppUrl('/cadastro', env.NEXT_PUBLIC_ROOT_DOMAIN),
    loginUrl: buildAppUrl('/entrar', env.NEXT_PUBLIC_ROOT_DOMAIN),
  }
}

/**
 * Cabeçalho fixo e claro. Na página de um perfil, mostra também o botão de criar a vitrine,
 * que leva o perfil junto (o assistente já abre com o tipo e o ramo do negócio).
 */
export function SiteHeader({ perfil }: { perfil?: string }) {
  const { signupUrl, loginUrl } = appLinks()
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6">
        <Link href="/" className="flex items-center gap-1.5 rounded-xl" aria-label="Vitrimove, página inicial">
          <LogoMark size={52} priority />
          <Wordmark className="text-[1.375rem]" />
        </Link>
        <nav aria-label="Conta" className="flex items-center gap-1.5 sm:gap-2">
          <a href={loginUrl} className={buttonClasses('ghost', '', 'sm')}>
            Entrar
          </a>
          {perfil ? (
            <span className="hidden sm:block">
              <a href={`${signupUrl}?perfil=${perfil}`} className={buttonClasses('primary', '', 'sm')}>
                Criar minha vitrine
              </a>
            </span>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
        <nav aria-label="Vitrimove para cada negócio" className="flex flex-col gap-3">
          <p className="text-sm font-black text-ink">Vitrimove para</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink-muted">
            {[...PERSONAS.filter((p) => p.group === 'produtos'), ...PERSONAS.filter((p) => p.group === 'servicos')].map((persona) => (
              <li key={persona.slug}>
                <Link href={`/${persona.slug}`} className="hover:text-go-strong">
                  {persona.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-4 border-t-2 border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Wordmark className="text-xl" />
            <p className="text-sm font-semibold text-ink-muted">
              {COMPANY.legalName} · CNPJ {COMPANY.cnpj}
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink-muted">
            <Link href="/termos" className="hover:text-ink">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-ink">
              Política de privacidade
            </Link>
            <a href={`mailto:${COMPANY.contactEmail}`} className="hover:text-ink">
              {COMPANY.contactEmail}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

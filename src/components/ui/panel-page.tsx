import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

/*
 * Cabeçalho do painel: faixa índigo (#1D1147) que sempre diz onde o lojista está.
 * À esquerda, voltar (opcional), ícone (opcional), título e uma linha de apoio; à direita, a ação da seção.
 * Fica grudado no topo enquanto a página rola.
 */
export function PanelTopBar({
  title,
  subtitle,
  back,
  leading,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { href: string; label: string }
  leading?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 bg-deep text-deep-ink [&_:focus-visible]:outline-go-bright">
      <div className="mx-auto flex min-h-[4.5rem] max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 lg:min-h-20 lg:px-8">
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label}
            title={back.label}
            className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-deep-muted transition-colors duration-150 hover:bg-deep-raised hover:text-white"
          >
            <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={3} />
          </Link>
        ) : null}
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-[1.25rem] font-black leading-tight tracking-[-0.025em] sm:text-[1.5rem]">{title}</h1>
          {subtitle ? <div className="min-w-0 truncate text-sm font-bold text-deep-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

// Corpo da página, na mesma coluna do cabeçalho.
export function PanelBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8 lg:px-8 ${className}`}>{children}</div>
}

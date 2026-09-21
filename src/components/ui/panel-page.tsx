import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

/*
 * Cabeçalho do painel: faixa clara e baixa que diz onde o lojista está sem roubar a cena do conteúdo.
 * À esquerda, voltar (opcional), ícone (opcional), título e uma linha de apoio; à direita, a ação da seção.
 * Fica grudado no topo enquanto a página rola, com o fundo levemente translúcido.
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
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label}
            title={back.label}
            className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-subtle hover:text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.75} />
          </Link>
        ) : null}
        {leading}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-lg font-black leading-tight tracking-[-0.02em] text-ink sm:text-xl">{title}</h1>
          {subtitle ? <div className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

// Corpo da página, na mesma coluna do cabeçalho.
export function PanelBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7 lg:px-10 ${className}`}>{children}</div>
}

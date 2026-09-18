import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

// Cabeçalho de página do painel: voltar (opcional), título forte, apoio curto e ações à direita.
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  back?: { href: string; label: string }
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1.5 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-extrabold text-ink-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={3} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[1.75rem] font-black leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2rem]">{title}</h1>
          {description ? <p className="max-w-prose text-base font-semibold text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

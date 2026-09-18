import { ChevronLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonClasses } from '@/components/ui/button'
import { TypeIcon } from '@/components/ui/type-icon'
import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { EditorTabs } from './editor-tabs'

export default async function VitrineEditorLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/painel"
          className="-ml-1.5 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-extrabold text-ink-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={3} />
          Minhas vitrines
        </Link>
        <div className="flex items-center gap-3.5">
          <TypeIcon type={vitrine.type as VitrineType} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="truncate text-[1.625rem] font-black leading-[1.15] tracking-[-0.025em] text-ink sm:text-[2rem]">
              {vitrine.name}
            </h1>
            <p className="truncate text-sm font-bold text-ink-muted">{url.replace(/^https?:\/\//, '')}</p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Abre a vitrine em uma nova aba"
            className={buttonClasses('secondary', 'shrink-0 max-sm:w-10 max-sm:px-0', 'sm')}
          >
            <ExternalLink aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.75} />
            {/* No celular fica só o ícone; o nome "Ver vitrine" continua para leitores de tela. */}
            <span className="max-sm:sr-only">Ver vitrine</span>
          </a>
        </div>
      </header>
      <EditorTabs vitrineId={id} />
      {children}
    </div>
  )
}

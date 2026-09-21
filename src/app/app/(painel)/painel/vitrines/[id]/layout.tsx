import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { TypeIcon } from '@/components/ui/type-icon'
import { getMyVitrine, getVideoUsage } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'
import { EditorTabs } from './editor-tabs'

export default async function VitrineEditorLayout({
  children,
  modal,
  params,
}: {
  children: ReactNode
  /** Novo item e edição de item abrem por cima da lista (rotas interceptadas em @modal). */
  modal: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [vitrine, usage] = await Promise.all([getMyVitrine(id), getVideoUsage()])
  const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
  const active = vitrine.status === 'active'

  return (
    <>
      {/* Uma vitrine por conta: o editor é a casa do painel, sem "voltar". */}
      <PanelTopBar
        leading={<TypeIcon type={vitrine.type as VitrineType} size="sm" />}
        title={vitrine.name}
        actions={
          <>
            <Badge tone={active ? 'success' : 'sun'}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-sun-lip'}`} />
              {active ? 'Ativa' : 'Congelada'}
            </Badge>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Abre a vitrine em uma nova aba"
              className={buttonClasses('secondary', 'max-sm:w-10 max-sm:px-0', 'sm')}
            >
              <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.75} />
              {/* No celular fica só o ícone; o nome "Ver vitrine" continua para leitores de tela. */}
              <span className="max-sm:sr-only">Ver vitrine</span>
            </a>
          </>
        }
      />
      <PanelBody className="flex flex-col gap-6">
        {usage.overQuota ? (
          <p role="status" className="rounded-card border border-danger/30 bg-danger-soft px-5 py-4 font-bold text-danger">
            A franquia de vídeo deste mês acabou. Os vídeos voltam no próximo mês.
          </p>
        ) : null}
        <EditorTabs vitrineId={id} type={vitrine.type as VitrineType} />
        {children}
      </PanelBody>
      {modal}
    </>
  )
}

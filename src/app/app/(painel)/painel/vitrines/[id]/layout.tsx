import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonClasses } from '@/components/ui/button'
import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { TypeIcon } from '@/components/ui/type-icon'
import { getMyVitrine } from '@/features/vitrines/queries'
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
  const vitrine = await getMyVitrine(id)
  const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)

  return (
    <>
      <PanelTopBar
        back={{ href: '/painel', label: 'Voltar para Minhas vitrines' }}
        leading={
          <span className="hidden sm:block">
            <TypeIcon type={vitrine.type as VitrineType} />
          </span>
        }
        title={vitrine.name}
        subtitle={url.replace(/^https?:\/\//, '')}
        actions={
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Abre a vitrine em uma nova aba"
            className={buttonClasses('primary', 'max-sm:w-11 max-sm:px-0', 'sm')}
          >
            <ExternalLink aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2.75} />
            {/* No celular fica só o ícone; o nome "Ver vitrine" continua para leitores de tela. */}
            <span className="max-sm:sr-only">Ver vitrine</span>
          </a>
        }
      />
      <PanelBody className="flex flex-col gap-6">
        <EditorTabs vitrineId={id} />
        {children}
      </PanelBody>
      {modal}
    </>
  )
}

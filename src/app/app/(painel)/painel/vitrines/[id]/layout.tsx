import type { ReactNode } from 'react'
import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{vitrine.name}</h1>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm underline">
          Ver vitrine
        </a>
      </div>
      <EditorTabs vitrineId={id} />
      {children}
    </div>
  )
}

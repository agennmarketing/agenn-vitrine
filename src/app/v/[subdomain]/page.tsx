import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl, originFor } from '@/lib/hosts/urls'
import { Catalog } from './catalog'

type Props = { params: Promise<{ subdomain: string }> }

// Lista vazia + sem APIs dinâmicas = cada vitrine é gerada na primeira visita e
// fica estática até revalidateTag (generate-static-params.md, "All paths at runtime").
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) return { title: 'Vitrine não encontrada' }
  const image = vitrine.banner?.large ?? vitrine.logo?.large
  const absoluteImage = image?.startsWith('http') ? image : undefined
  return {
    title: vitrine.name,
    description: vitrine.description || undefined,
    metadataBase: new URL(buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)),
    openGraph: {
      title: vitrine.name,
      description: vitrine.description || undefined,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
    icons: vitrine.logo?.small?.startsWith('http') ? { icon: vitrine.logo.small } : undefined,
    other: vitrine.brandColor ? { 'theme-color': vitrine.brandColor } : undefined,
  }
}

export default async function VitrinePage({ params }: Props) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) notFound()
  if (vitrine.status !== 'active') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">Vitrine indisponível no momento</h1>
      </main>
    )
  }
  return <Catalog vitrine={vitrine} siteUrl={originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)} />
}

import { Store } from 'lucide-react'
import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl, originFor } from '@/lib/hosts/urls'
import { logoMetadataIcons } from '@/lib/pwa/icons'
import { shortName, VITRINE_MANIFEST_PATH } from '@/lib/pwa/manifest'
import { Catalog } from './catalog'
import { vitrineTheme } from './theme'

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
    // A logo do lojista é o ícone da aba e o da tela de início; sem logo vale o do Agenn
    // (o `icon.png` da raiz, que o Next usa quando a página não declara ícone nenhum).
    icons: vitrine.logo ? logoMetadataIcons(vitrine.logo) : undefined,
    manifest: vitrine.status === 'active' ? VITRINE_MANIFEST_PATH : undefined,
    appleWebApp: { capable: true, title: shortName(vitrine.name), statusBarStyle: 'default' },
  }
}

// A cor do navegador (aba, barra de endereço) é a do lojista. Precisa sair no viewport, e
// não em `metadata.other`: com duas <meta name="theme-color"> na página o navegador usa a
// primeira, que é a da raiz — a cor da vitrine nunca chegava a valer.
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) return {}
  const { canvas } = vitrineTheme(vitrine.brandColor, vitrine.theme)
  return { themeColor: vitrine.brandColor ?? canvas }
}

export default async function VitrinePage({ params }: Props) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine) notFound()
  if (vitrine.status !== 'active') {
    return (
      <main
        style={vitrineTheme(vitrine.brandColor, vitrine.theme).style}
        className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center text-ink"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-subtle text-ink-muted">
          <Store aria-hidden="true" className="size-7" strokeWidth={2.25} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.02em]">Vitrine indisponível no momento</h1>
        <p className="mt-2 max-w-xs text-ink-muted">
          <span className="font-semibold text-ink">{vitrine.name}</span> não está recebendo pedidos por aqui agora. Tente de novo mais tarde.
        </p>
      </main>
    )
  }
  return <Catalog vitrine={vitrine} siteUrl={originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)} />
}

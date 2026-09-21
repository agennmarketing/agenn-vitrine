import { ExternalLink } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { ConfigBlock, SectionIntro } from '@/components/ui/config-section'
import { Input } from '@/components/ui/input'
import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { CopyLinkButton } from './copy-link-button'
import { QrCodeCard } from './qr-code-card'

export const metadata = { title: 'Compartilhar' }

export default async function CompartilharPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        title="Compartilhar"
        description="Coloque o link na bio do Instagram e no status do WhatsApp; o QR Code vai no balcão, na vitrine ou na embalagem."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ConfigBlock title="Link da vitrine" description="Quem abrir esse link vê a sua vitrine, sem precisar de cadastro.">
          <Input readOnly value={url.replace(/^https?:\/\//, '')} aria-label="Link da vitrine" className="numeric" />
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyLinkButton url={url} className="w-full" />
            <a href={url} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'w-full')}>
              <ExternalLink aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
              Abrir vitrine
            </a>
          </div>
        </ConfigBlock>
        <ConfigBlock title="QR Code" description="Imprima e deixe à vista dos clientes.">
          <QrCodeCard url={url} subdomain={vitrine.subdomain} />
        </ConfigBlock>
      </div>
    </div>
  )
}

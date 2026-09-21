import { AtSign, ExternalLink, MessageCircle, Store } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { SectionIntro } from '@/components/ui/config-section'
import { Input } from '@/components/ui/input'
import { getMyVitrine } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { CopyLinkButton } from './copy-link-button'
import { QrCodeCard } from './qr-code-card'

export const metadata = { title: 'Compartilhar' }

const TIPS = [
  { Icon: AtSign, title: 'Bio do Instagram', text: 'Cole o link no campo “Site” do perfil.' },
  { Icon: MessageCircle, title: 'WhatsApp', text: 'Mande no status e nas conversas com clientes.' },
  { Icon: Store, title: 'Balcão e embalagem', text: 'Imprima o QR Code e deixe à vista.' },
]

export default async function CompartilharPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const url = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro title="Compartilhar" description="Divulgue a sua vitrine pelo link ou pelo QR Code." />
      <section className="grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-black leading-snug tracking-[-0.02em] text-ink">Link da vitrine</h3>
              <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">
                Quem abrir esse link vê a sua vitrine, sem precisar de cadastro.
              </p>
            </div>
            <Input readOnly value={url.replace(/^https?:\/\//, '')} aria-label="Link da vitrine" className="numeric" />
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyLinkButton url={url} className="w-full" />
              <a href={url} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'w-full')}>
                <ExternalLink aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
                Abrir vitrine
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 className="text-sm font-extrabold text-ink-muted">Onde divulgar</h3>
            <ul className="grid gap-3 sm:grid-cols-3">
              {TIPS.map(({ Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3 rounded-control bg-canvas px-3.5 py-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-control bg-go-soft text-go-strong"
                  >
                    <Icon className="size-[1.125rem]" strokeWidth={2.5} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-extrabold leading-snug text-ink">{title}</span>
                    <span className="text-[0.8125rem] font-semibold leading-snug text-ink-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 border-t border-line bg-canvas p-5 sm:p-6 md:border-l md:border-t-0">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-lg font-black leading-snug tracking-[-0.02em] text-ink">QR Code</h3>
            <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">Aponte a câmera e a vitrine abre.</p>
          </div>
          <QrCodeCard url={url} subdomain={vitrine.subdomain} />
        </div>
      </section>
    </div>
  )
}

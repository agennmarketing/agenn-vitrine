import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { TypeIcon } from '@/components/ui/type-icon'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'

export default function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/logo-icone-512.png" alt="" width={40} height={40} className="size-10 rounded-xl" priority />
          <h1 className="text-lg font-black tracking-[-0.02em] text-deep">
            Agenn <span className="text-go-strong">Vitrine</span>
          </h1>
        </div>
        <Link href={buildAppUrl('/entrar', env.NEXT_PUBLIC_ROOT_DOMAIN)} className={buttonClasses('ghost', '', 'sm')}>
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
        <div aria-hidden="true" className="flex items-end gap-2">
          <span className="-rotate-6">
            <TypeIcon type="comida" size="lg" />
          </span>
          <span className="-translate-y-2">
            <TypeIcon type="servicos" size="lg" />
          </span>
          <span className="rotate-6">
            <TypeIcon type="produtos" size="lg" />
          </span>
        </div>
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-[2.5rem] font-black leading-[1.05] tracking-[-0.03em] text-ink sm:text-[3.5rem]">
            Sua vitrine com vídeo, com os pedidos chegando no <span className="text-go-strong">WhatsApp</span>.
          </p>
          <p className="max-w-xl text-lg font-semibold leading-relaxed text-ink-muted">
            Catálogos e cardápios com vídeo, prontos para o WhatsApp. Monte pelo celular, divulgue o link e receba o
            pedido pronto, com código.
          </p>
        </div>
        <Link
          href={buildAppUrl('/cadastro', env.NEXT_PUBLIC_ROOT_DOMAIN)}
          className={buttonClasses('primary', 'w-full sm:w-fit', 'lg')}
        >
          Criar minha vitrine
          <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />
        </Link>
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm font-bold text-ink-muted sm:px-6">
          <Link href="/termos" className="hover:text-ink">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:text-ink">
            Política de privacidade
          </Link>
        </div>
      </footer>
    </div>
  )
}

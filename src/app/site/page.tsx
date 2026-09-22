import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { TypeIcon } from '@/components/ui/type-icon'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'
import { LogoMark, Wordmark } from '@/components/brand/logo'

export default function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark size={44} priority />
          <h1>
            <Wordmark className="text-xl" />
          </h1>
        </div>
        <Link href={buildAppUrl('/entrar', env.NEXT_PUBLIC_ROOT_DOMAIN)} className={buttonClasses('ghost', '', 'sm')}>
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
        <div aria-hidden="true" className="flex items-end gap-2">
          <span className="-rotate-6">
            <TypeIcon type="servicos" size="lg" />
          </span>
        </div>
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-[2.5rem] font-black leading-[1.05] tracking-[-0.03em] text-ink sm:text-[3.5rem]">
            Sua vitrine com vídeo e <span className="text-go-strong">agenda online</span>.
          </p>
          <p className="max-w-xl text-lg font-semibold leading-relaxed text-ink-muted">
            Para manicures, salões, lash e sobrancelhas, barbearias e estética. Monte pelo celular, divulgue o link e
            o cliente escolhe um horário livre e agenda sozinho, sem dupla reserva.
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

import Link from 'next/link'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'

export default function MarketingHome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-6 px-4">
      <h1 className="text-4xl font-semibold tracking-tight">Agenn Vitrine</h1>
      <p className="text-lg text-ink-muted">Catálogos e cardápios com vídeo, prontos para o WhatsApp.</p>
      <Link href={buildAppUrl('/cadastro', env.NEXT_PUBLIC_ROOT_DOMAIN)} className="underline">
        Criar minha vitrine
      </Link>
      <footer className="flex gap-4 text-sm text-ink-muted">
        <Link href="/termos" className="underline">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="underline">
          Política de privacidade
        </Link>
      </footer>
    </main>
  )
}

import Image from 'next/image'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh">
      {/* Painel da marca: só em telas largas, onde sobra espaço. */}
      <aside className="hidden w-[40%] max-w-xl flex-col justify-between bg-brand p-12 text-brand-ink lg:flex">
        <Image
          src="/brand/logo-icone.png"
          alt=""
          width={56}
          height={56}
          className="rounded-2xl ring-1 ring-white/15"
          priority
        />
        <div className="max-w-sm">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.02em]">Agenn Vitrine</p>
          <p className="mt-3 text-lg leading-relaxed text-white/80">
            Catálogos e cardápios com vídeo, prontos para o WhatsApp.
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <Image
            src="/brand/logo-icone.png"
            alt="Agenn Vitrine"
            width={48}
            height={48}
            className="mb-8 rounded-xl lg:hidden"
            priority
          />
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]">{title}</h1>
          {description ? <p className="mt-2 text-base leading-relaxed text-ink-muted">{description}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-line pt-6 text-sm leading-6 text-ink-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}

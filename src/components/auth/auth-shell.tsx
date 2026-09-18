import { Check } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'

// Os quatro passos reais do assistente de criação, mostrados como a trilha do produto.
const TRAIL = ['Escolha o tipo do negócio', 'Dê nome e endereço', 'Informe o WhatsApp', 'Pedidos chegando prontos'] as const

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
    <div className="flex min-h-dvh bg-surface">
      {/* Painel da marca: só em telas largas, onde sobra espaço. */}
      <aside className="hidden w-[42%] max-w-xl flex-col justify-between bg-deep p-12 text-deep-ink lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo-icone-512.png" alt="" width={48} height={48} className="size-12 rounded-card ring-2 ring-white/15" />
          <span className="text-xl font-black tracking-[-0.02em]">
            Agenn <span className="text-go">Vitrine</span>
          </span>
        </div>

        <div className="flex max-w-sm flex-col gap-10">
          <p className="text-[2.5rem] font-black leading-[1.05] tracking-[-0.03em]">
            Sua vitrine no ar em <span className="text-go">4 passos</span>.
          </p>
          <ol className="relative flex flex-col gap-6">
            <span aria-hidden="true" className="absolute bottom-5 left-[1.1875rem] top-5 w-1 rounded-full bg-white/15" />
            {TRAIL.map((step, index) => {
              const last = index === TRAIL.length - 1
              return (
                <li key={step} className="relative flex items-center gap-4">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-base font-black ${
                      last ? 'bg-go text-go-ink shadow-[0_4px_0_var(--color-go-lip)]' : 'border-2 border-white/25 bg-deep-raised text-white'
                    }`}
                  >
                    {last ? <Check aria-hidden="true" className="size-5" strokeWidth={3.5} /> : index + 1}
                  </span>
                  <span className={`text-lg font-extrabold ${last ? 'text-white' : 'text-deep-muted'}`}>{step}</span>
                </li>
              )
            })}
          </ol>
        </div>

        <p className="text-sm font-semibold text-deep-muted">Catálogos e cardápios com vídeo, prontos para o WhatsApp.</p>
      </aside>

      <main className="flex min-w-0 flex-1 justify-center px-5 py-10 sm:items-center sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Image src="/brand/logo-icone-512.png" alt="Agenn Vitrine" width={44} height={44} className="size-11 rounded-xl" priority />
            <span aria-hidden="true" className="text-lg font-black tracking-[-0.02em] text-deep">
              Agenn <span className="text-go-strong">Vitrine</span>
            </span>
          </div>
          <h1 className="text-[2rem] font-black leading-[1.1] tracking-[-0.025em] text-ink">{title}</h1>
          {description ? <p className="mt-2 text-base font-semibold leading-relaxed text-ink-muted">{description}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-8 border-t-2 border-line pt-6 text-[0.9375rem] font-semibold leading-6 text-ink-muted [&_a]:font-extrabold [&_a]:text-go-strong">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

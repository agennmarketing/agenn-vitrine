import { ChevronDown, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { LegalSection } from '@/lib/legal/terms'
import { LogoMark, Wordmark } from '@/components/brand/logo'

// Os títulos vêm como "3. Planos, preços e pagamento": separamos o número para o índice.
function splitTitle(title: string) {
  const match = /^(\d+)\.\s*(.+)$/.exec(title)
  return match ? { number: match[1], text: match[2] } : { number: null, text: title }
}

const anchorFor = (index: number) => `secao-${index + 1}`

function Toc({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="flex flex-col gap-0.5">
      {sections.map((section, index) => {
        const { number, text } = splitTitle(section.title)
        return (
          <li key={anchorFor(index)}>
            <a
              href={`#${anchorFor(index)}`}
              className="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-sm font-bold leading-snug text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              {number ? <span className="numeric w-5 shrink-0 text-right font-black text-go-strong">{number}</span> : null}
              <span>{text}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

export function LegalDocument({
  title,
  updatedAt,
  sections,
}: {
  title: string
  updatedAt: string
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="group -ml-1.5 inline-flex items-center gap-2 rounded-control px-1.5 py-1 text-ink-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={3} />
            <LogoMark size={34} />
            <Wordmark className="text-base" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 lg:pt-14">
        {/* Índice: fixo ao lado no computador. */}
        <nav aria-label="Seções do documento" className="hidden lg:block">
          <div className="sticky top-8 flex max-h-[calc(100dvh-4rem)] flex-col gap-3 overflow-y-auto">
            <p className="px-2 text-sm font-extrabold text-ink">Nesta página</p>
            <Toc sections={sections} />
          </div>
        </nav>

        <main className="min-w-0">
          <article className="flex max-w-[68ch] flex-col">
            <h1 className="text-[2rem] font-black leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.5rem]">{title}</h1>
            <p className="mt-3 text-sm font-bold text-ink-muted">Última atualização: {updatedAt}</p>

            {/* No celular o índice fica recolhido, para o texto vir primeiro. */}
            <details className="group mt-8 rounded-card border-2 border-line bg-canvas lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                Nesta página
                <ChevronDown aria-hidden="true" className="size-5 text-ink-muted transition-transform group-open:rotate-180" strokeWidth={2.5} />
              </summary>
              <nav aria-label="Seções do documento (celular)" className="border-t-2 border-line px-2 py-2">
                <Toc sections={sections} />
              </nav>
            </details>

            <div className="mt-10 flex flex-col gap-10">
              {sections.map((section, index) => {
                const { number, text } = splitTitle(section.title)
                return (
                  <section key={anchorFor(index)} id={anchorFor(index)} className="flex scroll-mt-8 flex-col gap-3">
                    <h2 className="flex items-baseline gap-3 text-xl font-black leading-snug tracking-[-0.02em] text-ink">
                      {number ? (
                        <span className="numeric shrink-0 text-go-strong">
                          {number}
                          <span className="sr-only">.</span>
                        </span>
                      ) : null}
                      <span>{text}</span>
                    </h2>
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex} className="text-[1.0625rem] font-medium leading-[1.7] text-ink/85">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )
              })}
            </div>
          </article>
        </main>
      </div>
    </div>
  )
}

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

/*
 * Comemoração da trilha: o check "pula" dentro de um anel que se expande e some.
 * Usada nos marcos (vitrine criada, primeiro item). Sem movimento reduzido, fica só o check.
 */
// announce=false quando outro aviso (ex.: "Item salvo.") já fala pelo leitor de tela.
export function Celebration({ title, children, announce = true }: { title: string; children?: ReactNode; announce?: boolean }) {
  return (
    <section
      role={announce ? 'status' : undefined}
      className="flex items-center gap-4 rounded-card border-2 border-go/40 bg-go-soft px-4 py-4 sm:px-5"
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-go/40 motion-safe:animate-ping motion-safe:[animation-iteration-count:1]" />
        <span className="relative flex size-12 animate-pop items-center justify-center rounded-full bg-go text-go-ink shadow-[0_4px_0_var(--color-go-lip)]">
          <Check aria-hidden="true" className="size-6" strokeWidth={3.5} />
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-lg font-black leading-tight tracking-[-0.02em] text-ink">{title}</p>
        {children ? <p className="text-sm font-semibold text-ink-muted">{children}</p> : null}
      </div>
    </section>
  )
}

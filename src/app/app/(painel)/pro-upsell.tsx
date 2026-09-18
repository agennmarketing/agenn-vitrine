import { ArrowRight, Crown } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'

// Convite para o Pro (só no plano Gratuito): na barra lateral e, no celular, no fim de Minhas vitrines.
export function ProUpsell({ className = '' }: { className?: string }) {
  return (
    <aside
      aria-label="Plano Pro"
      className={`flex flex-col gap-3 rounded-card border-2 border-go/25 bg-go-soft p-4 ${className}`}
    >
      <Crown aria-hidden="true" className="size-6 text-go-strong" strokeWidth={2.5} />
      <div className="flex flex-col gap-1">
        <p className="text-[0.9375rem] font-black leading-snug tracking-[-0.015em] text-ink">
          Vá mais longe com o Plano Pro
        </p>
        <p className="text-sm font-semibold leading-snug text-ink-muted">Mais vitrines, mais vídeos e mais possibilidades.</p>
      </div>
      <Link href="/painel/plano" className={buttonClasses('primary', 'mt-1 w-full', 'sm')}>
        Fazer upgrade
        <ArrowRight aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.75} />
      </Link>
    </aside>
  )
}

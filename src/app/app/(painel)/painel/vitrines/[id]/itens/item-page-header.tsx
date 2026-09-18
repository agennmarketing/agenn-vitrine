import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

// Cabeçalho das telas de novo item e de edição: voltar para a lista e o título da tela.
export function ItemPageHeader({ vitrineId, title }: { vitrineId: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/painel/vitrines/${vitrineId}/itens`}
        className="-ml-1.5 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-extrabold text-ink-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={3} />
        Voltar para os itens
      </Link>
      <h2 className="text-[1.375rem] font-black leading-tight tracking-[-0.025em] text-ink sm:text-2xl">{title}</h2>
    </div>
  )
}

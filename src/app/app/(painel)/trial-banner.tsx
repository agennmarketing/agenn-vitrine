import { Clock } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'

// Aviso dos últimos dias do teste grátis, acima de qualquer página do painel.
export function TrialBanner({ message }: { message: string }) {
  return (
    <div role="status" className="border-b border-sun/50 bg-sun-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
        <p className="flex min-w-0 flex-1 items-center gap-2.5 text-[0.9375rem] font-extrabold leading-snug text-sun-ink">
          <Clock aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.5} />
          {message}
        </p>
        <Link href="/painel/plano" className={buttonClasses('sun', 'shrink-0', 'sm')}>
          Assinar
        </Link>
      </div>
    </div>
  )
}

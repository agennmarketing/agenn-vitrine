import { Card } from '@/components/ui/card'

export const metadata = { title: 'Minhas vitrines' }

export default function PainelHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Minhas vitrines</h1>
      <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center sm:py-16">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9.5 5.2 4h13.6l1.2 5.5" />
            <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
            <path d="M5 9.5V20h14V9.5" />
            <path d="M9.5 20v-5a2.5 2.5 0 0 1 5 0v5" />
          </svg>
        </div>
        <h2 className="text-lg font-medium leading-tight">Você ainda não tem vitrines</h2>
        <p className="max-w-sm text-ink-muted">
          Sua primeira vitrine vai aparecer aqui assim que você criá-la. Estamos preparando essa etapa.
        </p>
      </Card>
    </div>
  )
}

import { SearchX } from 'lucide-react'
import { vitrineTheme } from './theme'

export default function VitrineNotFound() {
  return (
    <main
      style={vitrineTheme(null, 'light').style}
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center text-ink"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-subtle text-ink-muted">
        <SearchX aria-hidden="true" className="size-7" strokeWidth={2.25} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.02em]">Vitrine não encontrada</h1>
      <p className="mt-2 max-w-xs text-ink-muted">Confira o endereço digitado.</p>
    </main>
  )
}

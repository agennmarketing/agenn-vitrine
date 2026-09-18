import { Check } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

/*
 * Opção grande e prensável (radio ou checkbox), no molde das respostas do Duolingo:
 * borda de 2px com lábio; marcada, fica roxa com um check que "pula".
 * O input real continua no DOM (acessível por rótulo e teclado), transparente por cima do cartão.
 * layout "row": ícone, texto e check em linha. "stack": prévia em cima, título embaixo, check no canto.
 */
export function ChoiceCard({
  title,
  description,
  icon,
  layout = 'row',
  className = '',
  type = 'radio',
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'title'> & {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  layout?: 'row' | 'stack'
}) {
  const stack = layout === 'stack'
  return (
    <label
      className={`group pressable relative flex cursor-pointer rounded-card border-2 border-line-strong bg-surface p-4 [--lip:var(--color-line-strong)] hover:bg-canvas has-[:checked]:border-go has-[:checked]:bg-go-soft has-[:checked]:[--lip:var(--color-go)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-go-strong has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
        stack ? 'flex-col gap-3' : 'min-h-16 items-center gap-4'
      } ${className}`}
    >
      {/* O input real cobre o cartão inteiro, transparente: o toque cai sempre nele. */}
      <input type={type} className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-card opacity-0 disabled:cursor-not-allowed" {...input} />
      {icon ? <span className={stack ? 'block' : 'shrink-0'}>{icon}</span> : null}
      <span className={`flex min-w-0 flex-1 flex-col gap-0.5 ${stack ? 'pr-8' : ''}`}>
        <span className="text-[1.0625rem] font-extrabold leading-snug text-ink">{title}</span>
        {description ? <span className="text-sm font-semibold leading-snug text-ink-muted">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-go-ink peer-checked:border-go peer-checked:bg-go [&>svg]:opacity-0 peer-checked:[&>svg]:animate-pop ${
          stack ? 'absolute bottom-4 right-4' : ''
        }`}
      >
        <Check className="size-4" strokeWidth={3.5} />
      </span>
    </label>
  )
}

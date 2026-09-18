/*
 * Barra de progresso da trilha: grossa, arredondada, com o brilho no topo do preenchimento
 * (o reflexo do Duolingo). A largura anima com sobressalto quando o valor muda.
 */
export function ProgressBar({
  value,
  max,
  label,
  tone = 'go',
  className = '',
}: {
  value: number
  max: number
  label: string
  tone?: 'go' | 'sun'
  className?: string
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-4 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div
        className={`relative h-full rounded-full transition-[width] duration-700 ease-out-back ${tone === 'go' ? 'bg-go' : 'bg-sun'}`}
        style={{ width: `${percent}%`, minWidth: value > 0 ? '1rem' : 0 }}
      >
        <span aria-hidden="true" className="absolute inset-x-2 top-[3px] h-[4px] rounded-full bg-white/35" />
      </div>
    </div>
  )
}

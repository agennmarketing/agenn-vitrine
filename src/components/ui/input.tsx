import type { InputHTMLAttributes } from 'react'

export function Input({
  invalid,
  className = '',
  'aria-describedby': describedBy,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  // Liga o campo à mensagem de erro que o Field renderiza em `${htmlFor}-error`.
  // `invalid` só deve ser true quando o Field que envolve o Input recebe `error` (é o Field que cria esse id).
  const errorId = invalid && props.id ? `${props.id}-error` : undefined
  const ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(' ') || undefined

  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      className={`h-11 w-full min-w-0 rounded-control border bg-surface px-3.5 text-base text-ink shadow-control transition-[border-color] duration-150 ease-out-quint placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted read-only:bg-canvas read-only:text-ink-muted read-only:shadow-none ${
        invalid
          ? 'border-danger focus-visible:outline-danger'
          : 'border-line-strong hover:border-ink-muted focus-visible:border-brand focus-visible:outline-brand'
      } ${className}`}
      {...props}
    />
  )
}

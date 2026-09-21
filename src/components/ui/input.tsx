import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function fieldControlClasses(invalid?: boolean) {
  return `min-w-0 rounded-control border-2 bg-surface px-4 text-base font-semibold text-ink transition-[border-color,background-color,box-shadow] duration-150 ease-out-quint placeholder:font-medium placeholder:text-ink-muted/80 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted read-only:bg-canvas read-only:text-ink-muted ${
    invalid
      ? 'border-danger bg-danger-soft/40 focus-visible:border-danger focus-visible:ring-4 focus-visible:ring-danger/15'
      : 'border-line-strong hover:border-ink-muted/60 focus-visible:border-go-strong focus-visible:ring-4 focus-visible:ring-go/15'
  }`
}

// Largura total por padrão; quem passa uma largura própria (w-*) fica com ela.
const width = (className: string) => (/(^|\s)w-/.test(className) ? '' : 'w-full')

// Liga o campo à mensagem de erro que o Field renderiza em `${htmlFor}-error`.
// `invalid` só deve ser true quando o Field que envolve o controle recebe `error` (é o Field que cria esse id).
function describedBy(invalid: boolean | undefined, id: string | undefined, extra: string | undefined) {
  const errorId = invalid && id ? `${id}-error` : undefined
  return [extra, errorId].filter(Boolean).join(' ') || undefined
}

export function Input({
  invalid,
  className = '',
  'aria-describedby': extra,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id, extra)}
      className={`h-12 ${width(className)} ${fieldControlClasses(invalid)} ${className}`}
      {...props}
    />
  )
}

export function Textarea({
  invalid,
  className = '',
  'aria-describedby': extra,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id, extra)}
      className={`min-h-28 py-3 leading-relaxed ${width(className)} ${fieldControlClasses(invalid)} ${className}`}
      {...props}
    />
  )
}

export function Select({
  invalid,
  className = '',
  'aria-describedby': extra,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(invalid, props.id, extra)}
      className={`select-chevron h-12 appearance-none pr-11 ${width(className)} ${fieldControlClasses(invalid)} ${className}`}
      {...props}
    />
  )
}

import type { InputHTMLAttributes } from 'react'

export function Input({ invalid, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`h-11 w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand read-only:bg-canvas read-only:text-ink-muted ${invalid ? 'border-danger' : 'border-line'} ${className}`}
      {...props}
    />
  )
}

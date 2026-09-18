import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[0.9375rem] font-extrabold leading-5 text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex animate-rise items-start gap-1.5 text-sm font-bold leading-5 text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2.5} />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-sm leading-5 text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

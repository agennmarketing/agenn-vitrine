import type { ReactNode } from 'react'

const TONES = {
  neutral: 'bg-subtle text-ink-muted',
  go: 'bg-go-soft text-go-strong',
  success: 'bg-success-soft text-success',
  sun: 'bg-sun-soft text-sun-ink',
  danger: 'bg-danger-soft text-danger',
  deep: 'bg-deep text-deep-ink',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-extrabold leading-none ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

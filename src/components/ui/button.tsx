import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:opacity-90',
} as const

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

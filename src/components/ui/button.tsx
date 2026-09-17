import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-brand text-brand-ink shadow-control hover:bg-brand-hover active:bg-brand-active focus-visible:outline-brand',
  secondary:
    'border border-line-strong bg-surface text-ink shadow-control hover:border-ink-muted hover:bg-canvas active:bg-subtle focus-visible:outline-brand',
  ghost: 'text-ink hover:bg-subtle active:bg-line focus-visible:outline-brand',
  danger: 'bg-danger text-white shadow-control hover:bg-danger-hover active:bg-danger-hover focus-visible:outline-danger',
} as const

export function buttonClasses(variant: keyof typeof VARIANTS = 'primary', className = '') {
  return `inline-flex h-11 select-none items-center justify-center gap-2 rounded-control px-4 text-[0.9375rem] font-semibold leading-none transition-[background-color,border-color,color,translate] duration-150 ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      {...props}
    />
  )
}

import type { ButtonHTMLAttributes } from 'react'

// Botões prensáveis (utilitário `pressable` no globals.css): o lábio de baixo usa --lip.
const VARIANTS = {
  primary: 'bg-go text-go-ink [--lip:var(--color-go-lip)] hover:bg-go-hover',
  secondary: 'border-2 border-line-strong bg-surface text-ink [--lip:var(--color-line-strong)] hover:bg-canvas',
  deep: 'bg-deep text-deep-ink [--lip:#000] hover:bg-deep-raised',
  sun: 'bg-sun text-sun-ink [--lip:var(--color-sun-lip)] hover:brightness-105',
  danger: 'bg-danger-fill text-white [--lip:var(--color-danger-lip)] hover:brightness-105',
  ghost: 'text-ink hover:bg-subtle active:bg-line',
} as const

const SIZES = {
  sm: 'h-10 rounded-[0.75rem] px-3.5 text-sm',
  md: 'h-12 rounded-control px-5 text-base',
  lg: 'h-14 rounded-card px-6 text-[1.0625rem]',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export function buttonClasses(variant: ButtonVariant = 'primary', className = '', size: ButtonSize = 'md') {
  const press = variant === 'ghost' ? 'transition-colors duration-150' : 'pressable'
  return `inline-flex select-none items-center justify-center gap-2 font-extrabold leading-none tracking-[-0.01em] ${press} disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-ink-muted ${SIZES[size]} ${VARIANTS[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, className, size)} {...props} />
}

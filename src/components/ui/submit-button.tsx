'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, type ButtonSize, type ButtonVariant } from './button'

export function SubmitButton({
  children,
  variant = 'primary',
  size = 'lg',
  className = 'w-full',
}: {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 animate-spin rounded-full border-[2.5px] border-current border-r-transparent`}
    />
  )
}

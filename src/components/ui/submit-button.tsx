'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from './button'

export function SubmitButton({
  children,
  variant = 'primary',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className="w-full">
      {children}
    </Button>
  )
}

'use client'

import type { ButtonHTMLAttributes } from 'react'

// Interruptor liga/desliga (role="switch"). O nome acessível vem de aria-label ou do texto ao lado.
export function Switch({
  checked,
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'aria-checked'> & { checked: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors duration-200 ease-out-quint disabled:cursor-not-allowed disabled:opacity-55 ${
        checked ? 'border-go-lip bg-go' : 'border-line-strong bg-line'
      } ${className}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className={`block size-6 rounded-full bg-white shadow-[0_2px_0_rgb(29_17_71/0.18)] transition-transform duration-300 ease-out-back ${
          checked ? 'translate-x-[1.625rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

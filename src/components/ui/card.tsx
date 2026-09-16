import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-card border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>
  )
}

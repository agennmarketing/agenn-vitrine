import type { ReactNode } from 'react'

// Elevação só por borda de 2px (sem sombra): o volume do sistema fica nos controles prensáveis.
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-card border-2 border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>
  )
}

import { Scissors, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

// Ícone de cada tipo de vitrine num quadrado colorido (a única área onde as cores de tipo aparecem).
const TYPE_STYLE: Record<VitrineType, { Icon: typeof Scissors; className: string }> = {
  comida: { Icon: UtensilsCrossed, className: 'bg-type-comida text-white [--lip:#c94a14]' },
  servicos: { Icon: Scissors, className: 'bg-type-servicos text-white [--lip:#b0266a]' },
  produtos: { Icon: ShoppingBag, className: 'bg-type-produtos text-white [--lip:#1c5cb8]' },
}

export function TypeIcon({ type, size = 'md' }: { type: VitrineType; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { Icon, className } = TYPE_STYLE[type]
  const box = { sm: 'size-9 rounded-[0.625rem]', md: 'size-12 rounded-control', lg: 'size-14 rounded-card', xl: 'size-16 rounded-[1.125rem]' }[size]
  const icon = { sm: 'size-5', md: 'size-6', lg: 'size-7', xl: 'size-8' }[size]
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center shadow-[0_3px_0_var(--lip)] ${box} ${className}`}
    >
      <Icon className={icon} strokeWidth={2.5} />
    </span>
  )
}

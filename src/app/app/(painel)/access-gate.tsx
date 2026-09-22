'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Sem acesso, só a tela do plano e a da conta abrem; o resto do painel dá lugar à
// tela de assinatura. As ações do servidor conferem o acesso por conta própria.
const OPEN_WHEN_BLOCKED = ['/painel/plano', '/painel/conta']

export function AccessGate({ blocked, wall, children }: { blocked: boolean; wall: ReactNode; children: ReactNode }) {
  const pathname = usePathname()
  if (!blocked || OPEN_WHEN_BLOCKED.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return children
  }
  return wall
}

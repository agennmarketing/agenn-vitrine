'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  ['itens', 'Itens'],
  ['aparencia', 'Aparência'],
  ['whatsapp', 'WhatsApp'],
  ['mensagens', 'Sacola e mensagens'],
  ['configuracoes', 'Configurações'],
] as const

export function EditorTabs({ vitrineId }: { vitrineId: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Seções da vitrine" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map(([slug, label]) => {
          const href = `/painel/vitrines/${vitrineId}/${slug}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`block border-b-2 px-3 py-2 text-sm ${active ? 'border-brand font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

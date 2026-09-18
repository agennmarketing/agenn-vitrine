'use client'

import { LayoutGrid, ListPlus, MessageCircle, Palette, Settings, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const TABS = [
  { slug: 'itens', label: 'Itens', Icon: LayoutGrid },
  { slug: 'complementos', label: 'Complementos', Icon: ListPlus },
  { slug: 'aparencia', label: 'Aparência', Icon: Palette },
  { slug: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { slug: 'mensagens', label: 'Sacola e mensagens', Icon: ShoppingBag },
  { slug: 'configuracoes', label: 'Configurações', Icon: Settings },
] as const

// Seções do editor como pílulas: a ativa vira a placa índigo-escura. No celular a fileira rola de lado.
export function EditorTabs({ vitrineId }: { vitrineId: string }) {
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)

  // Traz a aba ativa para a área visível da fileira, sem mexer na rolagem da página.
  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !active) return
    // A <ul> é `relative`, então offsetLeft do link é medido a partir dela.
    const left = active.offsetLeft - 16
    const right = active.offsetLeft + active.offsetWidth + 16 - list.clientWidth
    if (left < list.scrollLeft) list.scrollLeft = Math.max(0, left)
    else if (right > list.scrollLeft) list.scrollLeft = right
  }, [pathname])

  return (
    <nav aria-label="Seções da vitrine" className="-mx-4 lg:mx-0">
      <ul
        ref={listRef}
        className="relative flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] lg:flex-wrap lg:[mask-image:none] lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map(({ slug, label, Icon }) => {
          const href = `/painel/vitrines/${vitrineId}/${slug}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={slug} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-2 px-4 text-[0.9375rem] font-extrabold transition-colors duration-150 ease-out-quint ${
                  active
                    ? 'border-deep bg-deep text-deep-ink shadow-[0_3px_0_#000]'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={active ? 2.75 : 2.5} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

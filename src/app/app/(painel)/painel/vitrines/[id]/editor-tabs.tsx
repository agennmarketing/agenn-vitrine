'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { editorSections } from '@/lib/vitrines/editor-sections'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

// Seções do editor como pílulas: a ativa ganha borda e texto roxos. No celular a fileira rola de lado.
export function EditorTabs({ vitrineId, type }: { vitrineId: string; type: VitrineType }) {
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
        {editorSections(type).map(({ slug, label, Icon }) => {
          const href = `/painel/vitrines/${vitrineId}/${slug}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={slug} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full border-2 px-3.5 text-[0.9375rem] font-extrabold transition-colors duration-150 ease-out-quint ${
                  active
                    ? 'border-go-strong bg-surface text-go-strong'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <Icon aria-hidden="true" className="size-[1.0625rem] shrink-0" strokeWidth={active ? 2.75 : 2.25} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

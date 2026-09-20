'use client'

import { EllipsisVertical, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { editorSections } from '@/lib/vitrines/editor-sections'
import type { VitrineType } from '@/lib/vitrines/vitrine-types'

/*
 * Menu "mais opções" do cartão de vitrine: atalhos para cada seção do editor e para abrir a vitrine.
 * Mesmo comportamento do menu dos itens: setas, Home/End, Escape e clique fora fecham.
 */
export function VitrineCardMenu({
  vitrineId,
  type,
  name,
  url,
}: {
  vitrineId: string
  type: VitrineType
  name: string
  url: string
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const base = `/painel/vitrines/${vitrineId}`

  // As mesmas seções das abas do editor: cada tipo de vitrine mostra as suas.
  const links = editorSections(type).map(({ slug, label, Icon }) => ({ href: `${base}/${slug}`, label, Icon }))

  function items() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  }

  function close(returnFocus = true) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    const move = (next: number) => {
      event.preventDefault()
      list[(next + list.length) % list.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(list.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') close(false)
  }

  const itemClass =
    'flex h-11 items-center gap-3 rounded-[0.625rem] px-3 text-left text-[0.9375rem] font-extrabold text-ink transition-colors duration-150 hover:bg-subtle focus-visible:outline-offset-0'

  return (
    <div className="relative -mr-2 -mt-1 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Mais opções de ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={`flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-subtle hover:text-ink ${
          open ? 'bg-subtle text-ink' : ''
        }`}
      >
        <EllipsisVertical aria-hidden="true" className="size-5" strokeWidth={2.75} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Opções de ${name}`}
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-1.5 flex w-60 animate-rise flex-col rounded-card border-2 border-line bg-surface p-1.5 shadow-float"
        >
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <Icon aria-hidden="true" className="size-[1.125rem] shrink-0 text-ink-muted" strokeWidth={2.5} />
              {label}
            </Link>
          ))}
          <div role="separator" className="mx-2 my-1 h-0.5 rounded-full bg-line" />
          <a href={url} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <ExternalLink aria-hidden="true" className="size-[1.125rem] shrink-0 text-ink-muted" strokeWidth={2.5} />
            Ver vitrine
          </a>
        </div>
      ) : null}
    </div>
  )
}

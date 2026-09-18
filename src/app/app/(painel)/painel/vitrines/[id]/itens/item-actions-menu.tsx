'use client'

import { ArrowDown, ArrowUp, Copy, EllipsisVertical, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

type Action = {
  label: string
  Icon: typeof Copy
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

/*
 * Menu "mais ações" de um item: botão com aria-label e menu com setas, Home/End e Escape.
 * Abre para cima quando o botão está perto do fim da tela (barra inferior e botão flutuante).
 */
export function ItemActionsMenu({
  itemName,
  disabled,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  itemName: string
  disabled?: boolean
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const [open, setOpen] = useState(false)
  const [upward, setUpward] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const actions: Action[] = [
    { label: 'Duplicar', Icon: Copy, onSelect: onDuplicate },
    { label: 'Subir', Icon: ArrowUp, onSelect: onMoveUp, disabled: !canMoveUp },
    { label: 'Descer', Icon: ArrowDown, onSelect: onMoveDown, disabled: !canMoveDown },
    { label: 'Excluir', Icon: Trash2, onSelect: onDelete, danger: true },
  ]

  function items() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
  }

  function close(returnFocus = true) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  function toggle() {
    if (open) return close()
    const rect = buttonRef.current?.getBoundingClientRect()
    setUpward(!!rect && window.innerHeight - rect.bottom < 300)
    setOpen(true)
  }

  // Ao abrir, o foco vai para a primeira ação disponível; clicar fora fecha.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Mais ações para ${itemName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            toggle()
          }
        }}
        className={`flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${
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
          aria-label={`Ações de ${itemName}`}
          onKeyDown={onMenuKey}
          className={`absolute right-0 z-40 flex w-48 animate-rise flex-col rounded-card border-2 border-line bg-surface p-1.5 shadow-float ${
            upward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {actions.map(({ label, Icon, onSelect, disabled: off, danger }) => (
            <Fragment key={label}>
              {danger ? <div role="separator" className="mx-2 my-1 h-0.5 rounded-full bg-line" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={off}
                onClick={() => {
                  close()
                  onSelect()
                }}
                className={`flex h-11 items-center gap-3 rounded-[0.625rem] px-3 text-left text-[0.9375rem] font-extrabold transition-colors duration-150 focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-40 ${
                  danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-subtle'
                }`}
              >
                <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2.5} />
                {label}
              </button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}

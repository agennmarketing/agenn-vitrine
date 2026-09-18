'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
 * Lista reordenável por arrasto (dnd-kit), comum a categorias, itens, grupos, opções e variações.
 * O arrasto começa só pela alça: no computador pelo mouse, no celular pelo toque com um pequeno
 * atraso (para não brigar com a rolagem) e pelo teclado (Espaço/Enter pega, setas movem, Espaço
 * solta, Esc cancela), com anúncios em português para leitores de tela.
 * Enquanto arrasta, a linha levantada flutua com sombra e o lugar de destino fica marcado.
 */

export type SortableEntry = { id: string; label: string }

type ItemContextValue = {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: ReturnType<typeof useSortable>['listeners']
  setActivatorNodeRef: (element: HTMLElement | null) => void
  handleDisabled: boolean
}

const ListContext = createContext<{ disabled: boolean; handleDisabled: boolean }>({ disabled: false, handleDisabled: false })
const ItemContext = createContext<ItemContextValue | null>(null)

const noopSubscribe = () => () => {}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

// Numa lista vertical a linha só anda para cima e para baixo.
const restrictToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function SortableList({
  entries,
  onReorder,
  layout = 'vertical',
  disabled = false,
  handleDisabled = false,
  renderOverlay,
  children,
}: {
  entries: SortableEntry[]
  onReorder: (orderedIds: string[]) => void
  /** `vertical` para listas; `grid` para pílulas que rolam de lado ou quebram linha. */
  layout?: 'vertical' | 'grid'
  /** Bloqueia o arrasto (ex.: enquanto salva) sem tirar o foco da alça. */
  disabled?: boolean
  /** Desliga as alças de vez (ex.: durante a busca). */
  handleDisabled?: boolean
  /** Conteúdo da linha levantada; sem ele, mostra alça + nome. */
  renderOverlay?: (id: string) => ReactNode
  children: ReactNode
}) {
  const contextId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = entries.map((entry) => entry.id)
  const total = ids.length
  const labelOf = (id: UniqueIdentifier) => entries.find((entry) => entry.id === id)?.label ?? 'Item'
  const positionOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Pegou ${labelOf(active.id)}, posição ${positionOf(active.id)} de ${total}. Use as setas para mover, Espaço para soltar e Esc para cancelar.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} movido para a posição ${positionOf(over.id)} de ${total}.` : `${labelOf(active.id)} fora da lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(active.id)} solto na posição ${positionOf(over.id)} de ${total}.`
        : `${labelOf(active.id)} solto fora da lista. A ordem não mudou.`,
    onDragCancel: ({ active }) =>
      `Cancelado. ${labelOf(active.id)} voltou para a posição ${positionOf(active.id)} de ${total}.`,
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onReorder(arrayMove(ids, from, to))
  }

  const modifiers = layout === 'vertical' ? [restrictToVertical] : undefined
  const overlay = (
    <DragOverlay
      modifiers={modifiers}
      dropAnimation={reducedMotion ? null : { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      zIndex={60}
    >
      {activeId ? (
        <div
          className={`pointer-events-none flex size-full max-h-24 cursor-grabbing items-center gap-2 overflow-hidden rounded-control border-2 border-go bg-surface pr-3 shadow-float ${
            reducedMotion ? '' : 'scale-[1.03]'
          }`}
        >
          {renderOverlay ? (
            renderOverlay(activeId)
          ) : (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center text-go-strong">
                <GripVertical aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 truncate font-extrabold text-ink">{labelOf(activeId)}</span>
            </>
          )}
        </div>
      ) : null}
    </DragOverlay>
  )

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={modifiers}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para mudar a ordem, pressione Espaço ou Enter para pegar, use as setas para mover, Espaço ou Enter para soltar e Esc para cancelar.',
        },
      }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={layout === 'vertical' ? verticalListSortingStrategy : rectSortingStrategy}>
        <ListContext.Provider value={{ disabled: disabled || handleDisabled, handleDisabled }}>{children}</ListContext.Provider>
      </SortableContext>
      {/* No body: a linha levantada não fica presa em ancestrais com transform ou overflow. */}
      {mounted ? createPortal(overlay, document.body) : null}
    </DndContext>
  )
}

export function SortableItem({
  id,
  as = 'li',
  className = '',
  placeholderClassName = 'rounded-control',
  children,
}: {
  id: string
  as?: 'li' | 'div'
  className?: string
  /** Arredondamento da marca de destino, para casar com o formato da linha. */
  placeholderClassName?: string
  children: ReactNode
}) {
  const { disabled, handleDisabled } = useContext(ListContext)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    attributes: { roleDescription: 'item arrastável' },
  })
  const style = { transform: CSS.Translate.toString(transform), transition }
  const content = (
    <ItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef, handleDisabled }}>
      {children}
      {isDragging ? (
        // Lugar de destino: a linha original fica coberta por uma marca tracejada enquanto a cópia flutua.
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-go bg-go-soft ${placeholderClassName}`}
        />
      ) : null}
    </ItemContext.Provider>
  )
  const classes = `relative ${className}`
  return as === 'div' ? (
    <div ref={setNodeRef} style={style} className={classes}>
      {content}
    </div>
  ) : (
    <li ref={setNodeRef} style={style} className={classes}>
      {content}
    </li>
  )
}

const HANDLE_TONES = {
  default: 'text-ink-muted hover:bg-subtle hover:text-ink disabled:hover:bg-transparent',
  // Sobre a placa escura (deep) da pílula ativa.
  inverse: 'text-deep-muted hover:bg-deep-raised hover:text-deep-ink disabled:hover:bg-transparent',
} as const

/** Alça de arrastar. `className` define o tamanho (padrão 44 × 44 px). */
export function DragHandle({
  label,
  className = 'size-11 rounded-full',
  tone = 'default',
}: {
  label: string
  className?: string
  tone?: keyof typeof HANDLE_TONES
}) {
  const context = useContext(ItemContext)
  if (!context) throw new Error('DragHandle precisa estar dentro de SortableItem.')
  const { attributes, listeners, setActivatorNodeRef, handleDisabled } = context
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title="Arraste para mudar a ordem"
      disabled={handleDisabled}
      // after: área de toque de 44 px centrada, mesmo quando a alça desenhada é menor.
      className={`relative flex shrink-0 cursor-grab touch-none select-none items-center justify-center after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""] transition-colors duration-150 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-35 aria-disabled:cursor-default ${HANDLE_TONES[tone]} ${className}`}
    >
      <GripVertical aria-hidden="true" className="size-5" strokeWidth={2.5} />
    </button>
  )
}

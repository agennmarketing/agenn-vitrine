import { Minus, Plus, X } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'

/*
 * Peças visuais da vitrine pública. Nada do roxo/Nunito do painel: aqui a cor é a do
 * lojista (--color-brand, com --color-brand-ink por cima) e os traços de seleção usam
 * --color-accent (marca quando legível, senão a cor do texto).
 */

// Ícone do WhatsApp desenhado no mesmo traço dos ícones lucide (balão + fone).
export function WhatsAppIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path
        transform="translate(7 7) scale(0.42)"
        strokeWidth={5}
        d="M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39"
      />
    </svg>
  )
}

// Botão principal na cor da marca (pílula grande).
export const brandButtonClass =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-bold text-brand-ink shadow-[inset_0_0_0_1.5px_var(--color-brand-edge)] transition-[transform,opacity] duration-150 ease-out-quint active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100'

export function CloseButton({ onClick, buttonRef, className = '' }: { onClick: () => void; buttonRef?: Ref<HTMLButtonElement>; className?: string }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Fechar"
      onClick={onClick}
      className={`flex size-11 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.18)] ring-1 ring-line backdrop-blur transition-transform duration-150 active:scale-95 ${className}`}
    >
      <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
    </button>
  )
}

// Alça do bottom sheet (só visual, no celular).
export function SheetHandle() {
  return <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-line-strong md:hidden" />
}

export function StepButton({
  kind,
  tone = kind === 'plus' ? 'brand' : 'neutral',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind: 'minus' | 'plus'; tone?: 'brand' | 'neutral' }) {
  const Icon = kind === 'plus' ? Plus : Minus
  return (
    <button
      type="button"
      {...props}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-[transform,opacity] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 ${
        tone === 'brand'
          ? 'border-transparent bg-brand text-brand-ink shadow-[inset_0_0_0_1.5px_var(--color-brand-edge)]'
          : 'border-line-strong bg-surface text-ink'
      }`}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={2.75} />
    </button>
  )
}

// Cartão de opção (radio/checkbox): o input real cobre o cartão, transparente, e recebe o toque.
export const optionCardClass =
  'relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-line-strong has-[:checked]:border-(--color-accent) has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent) has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55'

export const optionInputClass = 'peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-2xl opacity-0 disabled:cursor-not-allowed'

// Indicador visual do radio/checkbox (irmão logo depois do input com `peer`).
export function OptionMark({ type }: { type: 'radio' | 'checkbox' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center border-2 border-line-strong bg-surface text-brand-ink transition-colors duration-150 peer-checked:border-(--color-accent) peer-checked:bg-(--color-accent) [&>span]:scale-0 peer-checked:[&>span]:scale-100 ${
        type === 'radio' ? 'rounded-full' : 'rounded-lg'
      }`}
    >
      {type === 'radio' ? (
        <span className="size-2.5 rounded-full bg-surface transition-transform duration-200 ease-out-back" />
      ) : (
        <span className="transition-transform duration-200 ease-out-back">
          <svg viewBox="0 0 24 24" className="size-4 text-surface" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}
    </span>
  )
}

// Rótulo pequeno de obrigatoriedade / limites de um grupo de escolha.
export function GroupBadge({ children, required }: { children: string; required: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${required ? 'bg-ink text-canvas' : 'bg-subtle text-ink-muted'}`}
    >
      {children}
    </span>
  )
}

export function TagList({ tags, className = '' }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
          {tag}
        </span>
      ))}
    </span>
  )
}

export const fieldClass =
  'h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink transition-colors duration-150 placeholder:text-ink-muted hover:border-line-strong focus-visible:border-(--color-accent) aria-invalid:border-danger'

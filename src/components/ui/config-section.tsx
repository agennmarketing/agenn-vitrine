import type { InputHTMLAttributes, ReactNode } from 'react'

/*
 * Peças das seções de configuração da vitrine (Complementos, WhatsApp, Sacola e mensagens,
 * Aparência, Configurações): título da seção, blocos, interruptor e barra de salvar.
 */

// Título da seção dentro do editor (o h1 com o nome da vitrine vem do layout).
export function SectionIntro({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[1.375rem] font-black leading-tight tracking-[-0.025em] text-ink sm:text-2xl">{title}</h2>
      <p className="max-w-prose font-semibold text-ink-muted">{description}</p>
    </div>
  )
}

// Bloco de um formulário: cartão com título, apoio opcional e selo à direita.
export function ConfigBlock({
  title,
  description,
  aside,
  tone = 'default',
  className = '',
  children,
}: {
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  tone?: 'default' | 'danger'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-5 rounded-card border-2 bg-surface p-5 sm:p-6 ${
        tone === 'danger' ? 'border-danger/45' : 'border-line'
      } ${className}`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-lg font-black leading-snug tracking-[-0.02em] ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
            {title}
          </h3>
          {aside}
        </div>
        {description ? <p className="text-[0.9375rem] font-semibold leading-snug text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/*
 * Interruptor liga/desliga que continua sendo um checkbox nativo (role="switch"):
 * vai no FormData pelo `name`, responde a getByLabel/toBeChecked e ao teclado (espaço).
 * O nome acessível é só o título; o apoio entra como descrição.
 */
export function ConfigToggle({
  id,
  title,
  description,
  className = '',
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'title'> & {
  id: string
  title: string
  description?: ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center justify-between gap-4 has-[:disabled]:cursor-not-allowed ${className}`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-extrabold leading-snug text-ink">{title}</span>
        {description ? (
          <span id={`${id}-desc`} className="text-sm font-semibold leading-snug text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={title}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-line transition-colors duration-200 ease-out-quint before:absolute before:left-0.5 before:top-1/2 before:size-6 before:-translate-y-1/2 before:rounded-full before:bg-white before:shadow-[0_2px_0_rgb(11_42_28/0.18)] before:transition-transform before:duration-300 before:ease-out-back before:content-[''] checked:border-go-lip checked:bg-go checked:before:translate-x-6 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-go-strong disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:before:transition-none"
        {...input}
      />
    </label>
  )
}

/*
 * Barra de salvar: no celular gruda no rodapé, logo acima da navegação inferior (h-16 + borda),
 * enquanto o formulário estiver na tela; no computador fica parada no fim do formulário.
 */
export function SaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.125rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-3 border-t-2 border-line bg-canvas px-4 py-3 sm:mx-0 sm:rounded-card sm:border-2 sm:px-4 lg:static lg:border-0 lg:bg-transparent lg:p-0">
      {children}
    </div>
  )
}

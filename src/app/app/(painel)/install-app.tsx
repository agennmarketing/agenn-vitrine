'use client'

import { Share, Smartphone, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useInstallPrompt } from '@/components/pwa/use-install-prompt'
import { buttonClasses } from '@/components/ui/button'

const HIDDEN_KEY = 'agenn:instalar-app-oculto'

/*
 * "Não mostrar mais" fica guardado no navegador, fora do React (como a sacola da
 * vitrine), sempre em try/catch: sem armazenamento, a faixa volta na próxima visita.
 */
const listeners = new Set<() => void>()
let hiddenCache: boolean | null = null

function isHidden() {
  if (hiddenCache === null) {
    try {
      hiddenCache = window.localStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      hiddenCache = false
    }
  }
  return hiddenCache
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function hide() {
  hiddenCache = true
  try {
    window.localStorage.setItem(HIDDEN_KEY, '1')
  } catch {
    // Modo privado ou cota cheia: vale só para esta visita.
  }
  listeners.forEach((listener) => listener())
}

/*
 * Faixa que convida o profissional a instalar o painel como aplicativo no celular.
 * Aparece acima de qualquer página, só para quem ainda pode instalar.
 */
export function InstallApp() {
  const { canInstall, needsGuide, install } = useInstallPrompt()
  const hidden = useSyncExternalStore(subscribe, isHidden, () => true)
  const [guideOpen, setGuideOpen] = useState(false)

  if (hidden || (!canInstall && !needsGuide)) return null

  return (
    <div role="status" className="border-b border-line bg-go-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
        <p className="flex min-w-0 flex-1 items-center gap-2.5 text-[0.9375rem] font-extrabold leading-snug text-go-strong">
          <Smartphone aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.5} />
          Instale o Vitrimove no celular: sua vitrine e sua agenda a um toque.
        </p>
        <button
          type="button"
          aria-expanded={needsGuide ? guideOpen : undefined}
          onClick={() => (canInstall ? void install() : setGuideOpen((open) => !open))}
          className={buttonClasses('primary', 'shrink-0', 'sm')}
        >
          Instalar
        </button>
        <button
          type="button"
          aria-label="Não mostrar mais"
          onClick={hide}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-go-strong transition-colors hover:bg-surface"
        >
          <X aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
        </button>
        {guideOpen ? (
          <p className="flex w-full items-start gap-2 text-[0.8125rem] leading-relaxed text-ink-muted">
            <Share aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
            <span>
              Toque em <span className="font-bold text-ink">Compartilhar</span> e escolha{' '}
              <span className="font-bold text-ink">Adicionar à Tela de Início</span>.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'

const CloseContext = createContext<() => void>(() => {})

// Fecha o popup do item (com a confirmação de alterações não salvas).
export function useCloseItemDialog() {
  return useContext(CloseContext)
}

/*
 * Popup do item, no molde da criação de vitrine: tela cheia no celular, janela central no computador.
 * Aberto pela lista (rota interceptada), fechar volta no histórico; aberto por link direto, vai para a lista.
 */
export function ItemDialog({
  vitrineId,
  label,
  intercepted = false,
  children,
}: {
  vitrineId: string
  label: string
  intercepted?: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const dirty = useRef(false)

  const close = useCallback(() => {
    if (dirty.current && !window.confirm('Sair sem salvar? As alterações deste item serão perdidas.')) return
    if (intercepted) router.back()
    else router.push(`/painel/vitrines/${vitrineId}/itens`)
  }, [intercepted, router, vitrineId])

  // Trava a rolagem da página por trás, leva o foco para o popup e fecha no Escape.
  useEffect(() => {
    const panel = panelRef.current
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    panel?.focus()
    const markDirty = () => {
      dirty.current = true
    }
    const markSaved = () => {
      dirty.current = false
    }
    const onKey = (event: KeyboardEvent) => {
      // Escape dentro de outro diálogo (recorte de imagem) é dele.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (panel && (event.target as Element | null)?.closest('[role="dialog"]') !== panel) return
      close()
    }
    panel?.addEventListener('input', markDirty)
    panel?.addEventListener('submit', markSaved)
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = previousOverflow
      panel?.removeEventListener('input', markDirty)
      panel?.removeEventListener('submit', markSaved)
      window.removeEventListener('keydown', onKey)
    }
  }, [close])

  return (
    <CloseContext.Provider value={close}>
      <div className="fixed inset-0 z-50 flex animate-fade items-stretch justify-center bg-deep/60 sm:items-center sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          // Sem "both": o transform não pode ficar no fim, senão o recorte de imagem (fixed) fica preso aqui dentro.
          className="flex h-dvh w-full flex-col overflow-hidden bg-canvas outline-none animate-[sheet-up_320ms_var(--ease-out-quint)_backwards] sm:h-[min(56rem,calc(100dvh-3rem))] sm:max-w-2xl sm:rounded-sheet sm:border-2 sm:border-line sm:shadow-float"
        >
          {children}
        </div>
      </div>
    </CloseContext.Provider>
  )
}

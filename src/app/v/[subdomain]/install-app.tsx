'use client'

import { ArrowDownToLine, Share } from 'lucide-react'
import { useState } from 'react'
import { useInstallPrompt } from '@/components/pwa/use-install-prompt'

/*
 * Convite discreto para o cliente guardar a vitrine como aplicativo no celular: fica no
 * cabeçalho da loja e só aparece em quem ainda pode instalar. No iPhone não existe o
 * convite do navegador, então o botão abre o caminho a seguir.
 */
export function InstallApp({ name }: { name: string }) {
  const { canInstall, needsGuide, install } = useInstallPrompt()
  const [guideOpen, setGuideOpen] = useState(false)
  if (!canInstall && !needsGuide) return null

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={needsGuide ? guideOpen : undefined}
        onClick={() => (canInstall ? void install() : setGuideOpen((open) => !open))}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-bold text-ink ring-1 ring-line transition-transform duration-150 ease-out-quint active:scale-[0.98]"
      >
        <ArrowDownToLine aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
        Instalar aplicativo
      </button>
      {guideOpen ? (
        <p className="mt-2 flex max-w-sm items-start gap-2 rounded-2xl bg-surface p-3 text-[0.8125rem] leading-relaxed text-ink-muted ring-1 ring-line">
          <Share aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          <span>
            Toque em <span className="font-bold text-ink">Compartilhar</span> e escolha{' '}
            <span className="font-bold text-ink">Adicionar à Tela de Início</span> para abrir {name} como aplicativo.
          </span>
        </p>
      ) : null}
    </div>
  )
}

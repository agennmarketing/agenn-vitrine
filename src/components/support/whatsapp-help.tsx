import { WhatsAppIcon } from '@/components/brand/whatsapp-icon'
import { COMPANY } from '@/lib/legal/company'
import { buildWhatsAppUrl } from '@/lib/whatsapp/messages'

const MESSAGES = {
  site: 'Olá! Vim do site da Vitrimove e quero tirar uma dúvida.',
  painel: 'Olá! Uso o painel da Vitrimove e quero tirar uma dúvida.',
} as const

/*
 * Botão flutuante "Tirar dúvida no WhatsApp" do site e do painel (nunca na vitrine).
 * No painel, no celular, vira só o ícone à esquerda, acima da barra inferior, porque
 * a direita já tem o "Novo item"; no modo foco a barra some e ele desce.
 */
export function WhatsAppHelp({ area }: { area: 'site' | 'painel' }) {
  const placement =
    area === 'painel'
      ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 size-14 justify-center group-has-[[data-focus-mode]]/shell:bottom-4 lg:bottom-6 lg:left-auto lg:right-6 lg:size-auto lg:px-5'
      : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 px-5 sm:bottom-6 sm:right-6'
  const label = area === 'painel' ? 'sr-only lg:not-sr-only' : ''

  return (
    <a
      href={buildWhatsAppUrl(COMPANY.supportWhatsApp, MESSAGES[area])}
      target="_blank"
      rel="noopener noreferrer"
      title="Tirar dúvida no WhatsApp"
      className={`fixed z-30 inline-flex h-14 items-center gap-2 rounded-full bg-whatsapp text-[0.9375rem] font-extrabold leading-none text-white shadow-float transition-[background-color,scale] duration-150 ease-out-quint hover:bg-whatsapp-hover active:scale-[0.97] ${placement}`}
    >
      <WhatsAppIcon className="size-6 shrink-0" />
      <span className={label}>Tirar dúvida no WhatsApp</span>
    </a>
  )
}

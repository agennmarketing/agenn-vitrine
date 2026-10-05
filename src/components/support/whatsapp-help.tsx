import Image from 'next/image'
import { COMPANY } from '@/lib/legal/company'
import { buildWhatsAppUrl } from '@/lib/whatsapp/messages'

const MESSAGES = {
  site: 'Olá! Vim do site da Vitrimove e quero tirar uma dúvida.',
  painel: 'Olá! Uso o painel da Vitrimove e quero tirar uma dúvida.',
} as const

/*
 * Botão flutuante de dúvida no WhatsApp do site e do painel (nunca na vitrine): só o
 * ícone roxo da marca (public/brand/whatsapp.svg, vindo do banco de imagens).
 * No painel, no celular, fica à esquerda, acima da barra inferior, porque a direita já
 * tem o "Novo item"; no modo foco a barra some e ele desce.
 */
export function WhatsAppHelp({ area }: { area: 'site' | 'painel' }) {
  const placement =
    area === 'painel'
      ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 group-has-[[data-focus-mode]]/shell:bottom-4 lg:bottom-6 lg:left-auto lg:right-6'
      : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 sm:bottom-6 sm:right-6'

  return (
    <a
      href={buildWhatsAppUrl(COMPANY.supportWhatsApp, MESSAGES[area])}
      target="_blank"
      rel="noopener noreferrer"
      title="Tirar dúvida no WhatsApp"
      aria-label="Tirar dúvida no WhatsApp"
      className={`fixed z-30 size-14 rounded-full shadow-float transition-[scale] duration-150 ease-out-quint hover:scale-105 active:scale-[0.97] ${placement}`}
    >
      <Image src="/brand/whatsapp.svg" alt="" width={56} height={56} unoptimized className="size-14" />
    </a>
  )
}

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

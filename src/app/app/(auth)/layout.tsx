import type { ReactNode } from 'react'
import { WhatsAppHelp } from '@/components/support/whatsapp-help'

// Entrar, cadastro e recuperação de senha: quem travou aqui pode chamar no WhatsApp.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WhatsAppHelp area="site" />
    </>
  )
}

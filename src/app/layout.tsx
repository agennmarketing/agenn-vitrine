import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Vitrimove', template: '%s · Vitrimove' },
  description: 'Vitrine de serviços com vídeo, com os pedidos de horário chegando no WhatsApp.',
  applicationName: 'Vitrimove',
  openGraph: { locale: 'pt_BR', siteName: 'Vitrimove' },
}

export const viewport: Viewport = { themeColor: '#ffffff', colorScheme: 'light' }

// A fonte entra no layout de cada área (app, site, vitrine): cada uma só baixa a sua.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

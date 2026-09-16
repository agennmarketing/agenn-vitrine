import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Agenn Vitrine', template: '%s · Agenn Vitrine' },
  description: 'Catálogos e cardápios com vídeo, prontos para o WhatsApp.',
  icons: { icon: '/brand/logo-icone.png' },
}

export const viewport: Viewport = { themeColor: '#0b2a1c' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={geist.variable}>{children}</body>
    </html>
  )
}

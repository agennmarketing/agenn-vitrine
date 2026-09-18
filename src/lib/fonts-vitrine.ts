import { Figtree } from 'next/font/google'

// Vitrine pública: Figtree, neutra, para a marca do lojista aparecer mais que a nossa.
// Módulo separado do painel: a vitrine (a página que precisa ser rápida no 4G) pré-carrega só esta fonte.
export const vitrineFont = Figtree({ subsets: ['latin'], display: 'swap' })

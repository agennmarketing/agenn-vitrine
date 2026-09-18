import { Figtree, Nunito } from 'next/font/google'

// Painel e acesso: Nunito, arredondada e pesada nos títulos — a pegada "trilha" pedida (estilo Duolingo).
export const appFont = Nunito({ subsets: ['latin', 'latin-ext'], display: 'swap', weight: 'variable' })

// Vitrine pública: Figtree, neutra, para a marca do lojista aparecer mais que a nossa.
export const vitrineFont = Figtree({ subsets: ['latin', 'latin-ext'], display: 'swap' })

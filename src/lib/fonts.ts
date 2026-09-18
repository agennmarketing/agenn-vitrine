import { Nunito } from 'next/font/google'

// Painel e acesso: Nunito, arredondada e pesada nos títulos — a pegada "trilha" pedida (estilo Duolingo).
// Só o subconjunto latin: cobre todo o português (ã, ç, é…); o latin-ext só custaria bytes.
// A fonte da vitrine mora em outro módulo (fonts-vitrine.ts) para cada área pré-carregar só a sua.
export const appFont = Nunito({ subsets: ['latin'], display: 'swap', weight: 'variable' })

import type { CSSProperties } from 'react'
import { readableTextColor } from '@/lib/color/contrast'

/*
 * Tema da vitrine pública: neutros próprios (não os verdes do painel), levemente
 * tingidos pela cor do lojista, nos dois temas. A cor da marca só entra como
 * preenchimento (com --color-brand-ink por cima); onde ela vira traço ou texto,
 * usamos --color-accent, que cai para a cor do texto quando a marca some no fundo.
 */

const DEFAULT_BRAND = '#673de6'

const LIGHT = {
  canvas: '#f7f7f5',
  surface: '#ffffff',
  subtle: '#efefec',
  ink: '#17181b',
  inkMuted: '#5c5d66',
  line: '#e6e6e2',
  lineStrong: '#cdcdc7',
}

const DARK = {
  canvas: '#0f0f11',
  surface: '#18181b',
  subtle: '#232327',
  ink: '#f4f4f2',
  inkMuted: '#a9a9b2',
  line: '#29292e',
  lineStrong: '#404047',
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

// Mistura `amount` (0–1) da cor `tint` sobre `base`.
function mix(base: string, tint: string, amount: number) {
  const a = rgb(base)
  const b = rgb(tint)
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number])
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

function normalize(hex: string | null) {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null
}

export function vitrineTheme(brandColor: string | null, theme: 'light' | 'dark') {
  const dark = theme === 'dark'
  const base = dark ? DARK : LIGHT
  const custom = normalize(brandColor)
  // Sem cor escolhida vale o roxo da Vitrimove, que aparece bem nos dois temas.
  const brand = custom ?? DEFAULT_BRAND
  const brandInk = readableTextColor(brand)
  const tint = custom ?? DEFAULT_BRAND
  const tintAmount = dark ? 0.05 : 0.035

  const canvas = mix(base.canvas, tint, tintAmount)
  const surface = mix(base.surface, tint, dark ? 0.04 : 0)
  const accent = contrast(brand, surface) >= 3 ? brand : base.ink
  // Preenchimentos na cor da marca ganham um contorno quando quase somem no fundo.
  const brandEdge = contrast(brand, canvas) < 1.6 ? (dark ? 'rgb(255 255 255 / 0.18)' : 'rgb(0 0 0 / 0.14)') : 'transparent'

  const style = {
    '--color-canvas': canvas,
    '--color-surface': surface,
    '--color-subtle': mix(base.subtle, tint, tintAmount + 0.02),
    '--color-ink': base.ink,
    '--color-ink-muted': base.inkMuted,
    '--color-line': mix(base.line, tint, tintAmount),
    '--color-line-strong': mix(base.lineStrong, tint, tintAmount),
    '--color-brand': brand,
    '--color-brand-ink': brandInk,
    '--color-brand-soft': mix(surface, brand, dark ? 0.2 : 0.1),
    '--color-brand-edge': brandEdge,
    '--color-accent': accent,
    '--color-danger': dark ? '#ff7a6b' : '#c4291c',
    // Foco e seleção do navegador na linguagem da vitrine, não no verde do painel.
    '--color-go-strong': accent,
    '--color-go-soft': mix(surface, brand, dark ? 0.35 : 0.2),
    '--color-go-ink': base.ink,
    colorScheme: dark ? 'dark' : 'light',
    caretColor: accent,
    accentColor: accent,
  } as CSSProperties

  return { style, canvas }
}

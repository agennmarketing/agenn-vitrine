function channel(hex: string, start: number) {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

// Texto sobre a cor da marca: branco ou preto, o de maior contraste (WCAG 2).
export function readableTextColor(hex: string): '#ffffff' | '#000000' {
  const luminance = 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
  const withWhite = 1.05 / (luminance + 0.05)
  const withBlack = (luminance + 0.05) / 0.05
  return withWhite >= withBlack ? '#ffffff' : '#000000'
}

import type { Metadata } from 'next'

/*
 * Ícones do aplicativo a partir da logo do lojista. A logo é quadrada e guardada em
 * duas larguras (IMAGE_SPECS.logo: 128 e 512), exatamente o que a aba do navegador, a
 * tela de início do celular e o manifesto do PWA precisam.
 */

export type SquareImage = { small: string; large: string; smallWidth: number; largeWidth: number }

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

// A extensão vem do caminho gravado no envio (`…-512.webp`); o que vier depois de `?` não conta.
export function imageMimeType(url: string): string | undefined {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase()
  return extension ? MIME_BY_EXTENSION[extension] : undefined
}

const square = (url: string, width: number) => ({ src: url, sizes: `${width}x${width}`, type: imageMimeType(url) })

// Formato do manifesto (`src`).
export function logoManifestIcons(logo: SquareImage) {
  return [square(logo.small, logo.smallWidth), square(logo.large, logo.largeWidth)]
}

// Formato do <head> (`url`): a logo vira o favicon da aba e o ícone da tela de início do iPhone.
export function logoMetadataIcons(logo: SquareImage): Metadata['icons'] {
  return {
    icon: logoManifestIcons(logo).map(({ src, sizes, type }) => ({ url: src, sizes, type })),
    apple: [{ url: logo.large, sizes: `${logo.largeWidth}x${logo.largeWidth}`, type: imageMimeType(logo.large) }],
  }
}

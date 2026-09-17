export type ImageRole = 'cover' | 'gallery' | 'logo' | 'banner'

type ImageSpec = {
  aspect: readonly [number, number]
  widths: readonly [number, number]
  maxBytes: readonly [number, number]
}

export const IMAGE_SPECS: Record<ImageRole, ImageSpec> = {
  cover: { aspect: [4, 5], widths: [480, 1080], maxBytes: [400_000, 1_500_000] },
  gallery: { aspect: [4, 5], widths: [480, 1080], maxBytes: [400_000, 1_500_000] },
  logo: { aspect: [1, 1], widths: [128, 512], maxBytes: [100_000, 600_000] },
  banner: { aspect: [16, 9], widths: [960, 1920], maxBytes: [600_000, 2_500_000] },
}

export function heightFor(role: ImageRole, width: number): number {
  const [w, h] = IMAGE_SPECS[role].aspect
  return Math.round((width * h) / w)
}

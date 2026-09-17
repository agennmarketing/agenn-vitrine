import { imageSize } from 'image-size'

export type ImageFormat = { ext: 'webp' | 'jpg'; contentType: 'image/webp' | 'image/jpeg' }

const text = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))

export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  return null
}

export function validateImageFile(
  bytes: Uint8Array,
  expected: { width: number; height: number; maxBytes: number },
): { ok: true; format: ImageFormat } | { ok: false; reason: 'size' | 'type' | 'dimensions' } {
  if (bytes.length > expected.maxBytes) return { ok: false, reason: 'size' }
  const format = sniffImageFormat(bytes)
  if (!format) return { ok: false, reason: 'type' }
  let size: { width?: number; height?: number }
  try {
    size = imageSize(bytes)
  } catch {
    return { ok: false, reason: 'type' }
  }
  if (size.width !== expected.width || size.height !== expected.height) return { ok: false, reason: 'dimensions' }
  return { ok: true, format }
}

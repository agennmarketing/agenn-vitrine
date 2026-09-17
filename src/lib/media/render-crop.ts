import { heightFor, IMAGE_SPECS, type ImageRole } from './image-specs'

export type PixelCrop = { x: number; y: number; width: number; height: number }

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
}

// WebP quando o navegador codifica; senão (Safari) JPEG. O servidor aceita os dois.
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg')
  if (!jpeg) throw new Error('Não foi possível converter a imagem.')
  return jpeg
}

export async function renderCrop(file: Blob, crop: PixelCrop, role: ImageRole): Promise<[Blob, Blob]> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const blobs: Blob[] = []
    for (const width of IMAGE_SPECS[role].widths) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = heightFor(role, width)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas indisponível.')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      blobs.push(await encode(canvas))
    }
    return [blobs[0], blobs[1]]
  } finally {
    bitmap.close()
  }
}

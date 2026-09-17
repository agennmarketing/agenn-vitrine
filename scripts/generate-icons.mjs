// Gera os ícones do app a partir do logo original (assets/brand/logo-icone.png, fora de public/ para não ser publicado).
// Rodar de novo quando o logo mudar:  node scripts/generate-icons.mjs
//
// Saídas:
//   src/app/icon.png                (192×192)  convenção de arquivo do Next
//   src/app/apple-icon.png          (180×180)  convenção de arquivo do Next
//   src/app/favicon.ico             ICO com PNGs 32×32 e 48×48
//   public/brand/logo-icone-512.png (512×512)  uso dentro do app (next/image)
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const SOURCE = 'assets/brand/logo-icone.png'

function png(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer()
}

// ICO: ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes cada) + imagens PNG (em RGBA: o decodificador do Next exige).
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reservado
  header.writeUInt16LE(1, 2) // tipo 1 = ícone
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // largura
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // altura
    entry.writeUInt8(0, 2) // cores na paleta (0 = sem paleta)
    entry.writeUInt8(0, 3) // reservado
    entry.writeUInt16LE(1, 4) // planos
    entry.writeUInt16LE(32, 6) // bits por pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)])
}

const outputs = [
  ['src/app/icon.png', await png(192)],
  ['src/app/apple-icon.png', await png(180)],
  ['public/brand/logo-icone-512.png', await png(512)],
  [
    'src/app/favicon.ico',
    buildIco([
      { size: 32, data: await sharp(SOURCE).resize(32, 32).ensureAlpha().png({ compressionLevel: 9 }).toBuffer() },
      { size: 48, data: await sharp(SOURCE).resize(48, 48).ensureAlpha().png({ compressionLevel: 9 }).toBuffer() },
    ]),
  ],
]

for (const [path, data] of outputs) {
  await writeFile(path, data)
  console.log(`${path}  ${data.length} bytes`)
}

// Gera os ícones e a logo publicada a partir dos originais em assets/brand/ (fora de public/ para não serem publicados).
// Rodar de novo quando a marca mudar:  node scripts/generate-icons.mjs
//
// Saídas:
//   src/app/icon.png                    (192×192)  convenção de arquivo do Next (painel e site)
//   src/app/apple-icon.png              (180×180)  convenção de arquivo do Next, fundo branco (o iOS pinta a transparência de preto)
//   public/favicon.ico                  ICO com PNGs 32×32 e 48×48 (fica em public/, não em app/: ver o favicon por vitrine)
//   public/brand/vitrimove-marca-512.png (512×512) ícone do PWA do painel
//   public/brand/vitrimove-logo.svg     logo completa (mascote com as linhas de velocidade), usada pelo LogoMark
import { copyFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const FAVICON = 'assets/brand/vitrimove-favicon.png'
const LOGO = 'assets/brand/vitrimove-logo.svg'
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

// O mascote não é quadrado: centraliza num quadrado, com uma margem em volta.
function square(size, { padding = 0, background = TRANSPARENT } = {}) {
  const inner = Math.round(size * (1 - 2 * padding))
  return sharp(FAVICON)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .toBuffer()
    .then((buffer) =>
      sharp({ create: { width: size, height: size, channels: 4, background } })
        .composite([{ input: buffer, gravity: 'center' }])
        .png({ compressionLevel: 9 })
        .toBuffer(),
    )
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
  ['src/app/icon.png', await square(192, { padding: 0.04 })],
  ['src/app/apple-icon.png', await square(180, { padding: 0.12, background: WHITE })],
  ['public/brand/vitrimove-marca-512.png', await square(512, { padding: 0.1 })],
  ['public/favicon.ico', buildIco([{ size: 32, data: await square(32) }, { size: 48, data: await square(48) }])],
]

for (const [path, data] of outputs) {
  await writeFile(path, data)
  console.log(`${path}  ${data.length} bytes`)
}
await copyFile(LOGO, 'public/brand/vitrimove-logo.svg')
console.log('public/brand/vitrimove-logo.svg  copiada')

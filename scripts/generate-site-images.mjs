// Gera as imagens do Vitri da página de vendas (public/site/*.webp) a partir dos originais em
// "banco de imagens/Imagens para a Página de vendas". Remove os pontinhos soltos em volta do adesivo
// (aparecem em fundo escuro), recorta a sobra transparente e salva em WebP de até 900px.
// Rodar de novo quando os originais mudarem:  node scripts/generate-site-images.mjs
import sharp from 'sharp'
const dir = 'banco de imagens/Imagens para a Página de vendas/'
const files = {
  'vitri': 'Imagem do Vitri - Mascote da Vitrimove.png',
  'vitri-manicure': 'Vitri vestido de Manicure.png',
  'vitri-cabeleireira': 'Vitri vestido de Cabeleireira.png',
  'vitri-produtos': 'Vitri vestido de vendedor de produtos.png',
  'vitri-afiliado': 'Vitri vestido de afiliado.png',
}
for (const [name, file] of Object.entries(files)) {
  const { data, info } = await sharp(dir + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const label = new Int32Array(w * h).fill(-1)
  const sizes = []
  const stack = []
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || data[i * 4 + 3] <= 8) continue
    const id = sizes.length; let n = 0
    label[i] = id; stack.push(i)
    while (stack.length) {
      const p = stack.pop(); n++
      const x = p % w, y = (p / w) | 0
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        if (label[q] === -1 && data[q * 4 + 3] > 8) { label[q] = id; stack.push(q) }
      }
    }
    sizes.push(n)
  }
  let removed = 0
  for (let i = 0; i < w * h; i++) {
    const l = label[i]
    if (l === -1 ? data[i * 4 + 3] > 0 : sizes[l] < 500) { data[i * 4 + 3] = 0; if (l !== -1) removed++ }
  }
  console.log(name, 'pontos removidos:', removed)
  const img = sharp(data, { raw: { width: w, height: h, channels: 4 } })
  const trimmed = await img.png().toBuffer()
  const t = await sharp(trimmed).trim({ threshold: 1 }).resize({ width: 900, height: 900, fit: 'inside' }).toBuffer({ resolveWithObject: true })
  await sharp(t.data).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`public/site/${name}.webp`)
}

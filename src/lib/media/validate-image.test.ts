import { describe, expect, it } from 'vitest'
import { sniffImageFormat, validateImageFile } from './validate-image'

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))

// WebP sem perdas (VP8L) mínimo, só com o cabeçalho de dimensões.
function fakeWebp(width: number, height: number) {
  const bytes = new Uint8Array(30)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii('RIFF'), 0)
  view.setUint32(4, 22, true)
  bytes.set(ascii('WEBP'), 8)
  bytes.set(ascii('VP8L'), 12)
  view.setUint32(16, 10, true)
  bytes[20] = 0x2f
  view.setUint32(21, (width - 1) | ((height - 1) << 14), true)
  return bytes
}

// JPEG mínimo: SOI, APP0 e SOF0 com as dimensões.
function fakeJpeg(width: number, height: number) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF'), 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ])
}

describe('sniffImageFormat', () => {
  it('reconhece WebP e JPEG pelos bytes', () => {
    expect(sniffImageFormat(fakeWebp(480, 600))).toEqual({ ext: 'webp', contentType: 'image/webp' })
    expect(sniffImageFormat(fakeJpeg(480, 600))).toEqual({ ext: 'jpg', contentType: 'image/jpeg' })
    expect(sniffImageFormat(new Uint8Array(ascii('<svg></svg>')))).toBeNull()
  })
})

describe('validateImageFile', () => {
  const expected = { width: 480, height: 600, maxBytes: 300_000 }

  it('aceita dimensões exatas', () => {
    expect(validateImageFile(fakeWebp(480, 600), expected)).toMatchObject({ ok: true })
    expect(validateImageFile(fakeJpeg(480, 600), expected)).toMatchObject({ ok: true })
  })

  it('recusa dimensões, tipo e tamanho errados', () => {
    expect(validateImageFile(fakeWebp(480, 601), expected)).toEqual({ ok: false, reason: 'dimensions' })
    expect(validateImageFile(new Uint8Array(ascii('GIF89a......')), expected)).toEqual({ ok: false, reason: 'type' })
    expect(validateImageFile(fakeWebp(480, 600), { ...expected, maxBytes: 10 })).toEqual({ ok: false, reason: 'size' })
  })
})

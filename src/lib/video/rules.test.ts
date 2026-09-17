import { describe, expect, it } from 'vitest'
import {
  aspectFor,
  bunnyStatusToMedia,
  clampReportedBytes,
  estimateBytesFromSeconds,
  formatGigabytes,
  validateVideoFile,
} from './rules'

const limits = { maxSeconds: 60, maxUploadMb: 500 }
const ok = { durationSeconds: 12.4, sizeBytes: 10 * 1024 * 1024, width: 1080, height: 1920 }

describe('aspectFor', () => {
  it('horizontal ou quadrado = 16:9; vertical = 9:16', () => {
    expect(aspectFor(1920, 1080)).toBe('16:9')
    expect(aspectFor(1000, 1000)).toBe('16:9')
    expect(aspectFor(1080, 1920)).toBe('9:16')
  })
})

describe('validateVideoFile', () => {
  it('aceita e arredonda a duração', () => {
    expect(validateVideoFile(ok, limits, 'video')).toEqual({ ok: true, aspect: '9:16', durationSeconds: 12 })
  })

  it('recusa com o motivo em português (spec 10)', () => {
    expect(validateVideoFile({ ...ok, durationSeconds: Number.NaN }, limits, 'video')).toEqual({
      ok: false,
      message: 'Não foi possível ler o vídeo. Tente outro arquivo.',
    })
    expect(validateVideoFile({ ...ok, width: 0 }, limits, 'video').ok).toBe(false)
    expect(validateVideoFile({ ...ok, durationSeconds: 61 }, limits, 'video')).toEqual({
      ok: false,
      message: 'O vídeo tem 61 s. O limite é 60 s.',
    })
    expect(validateVideoFile({ ...ok, sizeBytes: 501 * 1024 * 1024 }, limits, 'video')).toEqual({
      ok: false,
      message: 'O arquivo tem 501 MB. O limite é 500 MB.',
    })
    expect(validateVideoFile(ok, limits, 'banner')).toEqual({
      ok: false,
      message: 'O banner em vídeo precisa ser horizontal.',
    })
  })

  it('tolera meio segundo acima do limite (arredondamento do arquivo)', () => {
    expect(validateVideoFile({ ...ok, durationSeconds: 60.4 }, limits, 'video').ok).toBe(true)
  })
})

describe('bunnyStatusToMedia', () => {
  it('mapeia os códigos do webhook', () => {
    expect([3, 4].map(bunnyStatusToMedia)).toEqual(['ready', 'ready'])
    expect([5, 8].map(bunnyStatusToMedia)).toEqual(['failed', 'failed'])
    expect([0, 1, 2, 6, 7, 9, 10].map(bunnyStatusToMedia)).toEqual(Array(7).fill('processing'))
  })
})

describe('bytes entregues', () => {
  it('limita os bytes relatados a 1,5 × 4 Mbps por segundo, com no máximo 120 s por relatório', () => {
    expect(clampReportedBytes(1_000_000, 10)).toBe(1_000_000)
    expect(clampReportedBytes(10_000_000, 10)).toBe(7_500_000)
    expect(clampReportedBytes(999_999_999, 1000)).toBe(90_000_000)
    expect(clampReportedBytes(-5, 10)).toBe(0)
    expect(clampReportedBytes(100, 0)).toBe(0)
    expect(clampReportedBytes(Number.NaN, 10)).toBe(0)
  })

  it('estima bytes no HLS nativo por 2,8 Mbps', () => {
    expect(estimateBytesFromSeconds(8)).toBe(2_800_000)
    expect(estimateBytesFromSeconds(-1)).toBe(0)
  })

  it('formata gigabytes', () => {
    expect(formatGigabytes(0)).toBe('0,0 GB')
    expect(formatGigabytes(1024 ** 3 * 1.25)).toBe('1,3 GB')
  })
})

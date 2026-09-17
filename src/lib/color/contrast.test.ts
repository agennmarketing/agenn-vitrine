import { expect, it } from 'vitest'
import { readableTextColor } from './contrast'

it('escolhe branco ou preto pelo maior contraste (WCAG)', () => {
  expect(readableTextColor('#0b2a1c')).toBe('#ffffff')
  expect(readableTextColor('#000000')).toBe('#ffffff')
  expect(readableTextColor('#ffffff')).toBe('#000000')
  expect(readableTextColor('#ffeb3b')).toBe('#000000')
  expect(readableTextColor('#1e88e5')).toBe('#000000')
  expect(readableTextColor('#c62828')).toBe('#ffffff')
})

import { describe, expect, it } from 'vitest'
import { isSameIdSet, moveInList } from './reorder'

it('move um id para cima ou para baixo', () => {
  expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
  expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  expect(moveInList(['a', 'b', 'c'], 'a', 'up')).toBeNull()
  expect(moveInList(['a', 'b', 'c'], 'c', 'down')).toBeNull()
  expect(moveInList(['a', 'b'], 'x', 'up')).toBeNull()
})

describe('isSameIdSet', () => {
  it('aceita a mesma lista em outra ordem', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
    expect(isSameIdSet([], [])).toBe(true)
  })

  it('recusa lista com item a mais, a menos ou trocado', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'b'])).toBe(false)
    expect(isSameIdSet(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'b', 'x'])).toBe(false)
  })

  it('recusa ids repetidos mesmo com o tamanho certo', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'a', 'b'])).toBe(false)
  })

  it('recusa o que não é lista de textos', () => {
    expect(isSameIdSet(['a'], 'a')).toBe(false)
    expect(isSameIdSet(['a'], null)).toBe(false)
    expect(isSameIdSet(['1'], [1])).toBe(false)
  })
})

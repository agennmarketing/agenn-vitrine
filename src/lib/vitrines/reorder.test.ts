import { expect, it } from 'vitest'
import { moveInList } from './reorder'

it('move um id para cima ou para baixo', () => {
  expect(moveInList(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
  expect(moveInList(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  expect(moveInList(['a', 'b', 'c'], 'a', 'up')).toBeNull()
  expect(moveInList(['a', 'b', 'c'], 'c', 'down')).toBeNull()
  expect(moveInList(['a', 'b'], 'x', 'up')).toBeNull()
})

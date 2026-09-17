import { describe, expect, it } from 'vitest'
import { addToCart, cartLineKey, parseStoredCart, removeLine, replaceLine, serializeCart, setLineQty } from './cart'

const xBacon = { itemId: 'i1', variationId: null, qty: 1, note: '', addons: [{ optionId: 'o-bacon', qty: 2 }] }

describe('linhas da sacola', () => {
  it('mesma escolha junta quantidade; escolha diferente vira outra linha', () => {
    let lines = addToCart([], xBacon)
    lines = addToCart(lines, { ...xBacon, qty: 2 })
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(3)
    lines = addToCart(lines, { ...xBacon, note: 'sem cebola' })
    expect(lines).toHaveLength(2)
  })

  it('ordem dos complementos não muda a chave e o limite é 99', () => {
    const a = cartLineKey({ ...xBacon, addons: [{ optionId: 'x', qty: 1 }, { optionId: 'y', qty: 1 }] })
    const b = cartLineKey({ ...xBacon, addons: [{ optionId: 'y', qty: 1 }, { optionId: 'x', qty: 1 }] })
    expect(a).toBe(b)
    expect(addToCart([], { ...xBacon, qty: 150 })[0].qty).toBe(99)
  })

  it('quantidade, remover e trocar', () => {
    const lines = addToCart([], xBacon)
    const key = lines[0].key
    expect(setLineQty(lines, key, 5)[0].qty).toBe(5)
    expect(setLineQty(lines, key, 0)).toEqual([])
    expect(removeLine(lines, key)).toEqual([])
    const replaced = replaceLine(lines, key, { ...xBacon, note: 'bem passado' })
    expect(replaced).toHaveLength(1)
    expect(replaced[0].note).toBe('bem passado')
  })

  it('trocar para uma escolha que já existe junta as linhas', () => {
    let lines = addToCart([], xBacon)
    lines = addToCart(lines, { ...xBacon, note: 'x' })
    const merged = replaceLine(lines, lines[1].key, { ...xBacon, qty: 4 })
    expect(merged).toHaveLength(1)
    expect(merged[0].qty).toBe(5)
  })
})

describe('guardar no aparelho', () => {
  it('ida e volta', () => {
    const lines = addToCart([], xBacon)
    expect(parseStoredCart(serializeCart(lines))).toEqual(lines)
  })

  it('conteúdo inválido vira sacola vazia', () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart('{')).toEqual([])
    expect(parseStoredCart('{"version":2,"lines":[]}')).toEqual([])
    expect(parseStoredCart('{"version":1,"lines":[{"itemId":"i1","qty":0}]}')).toEqual([])
  })
})

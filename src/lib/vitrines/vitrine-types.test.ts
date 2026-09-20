import { expect, it } from 'vitest'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES, VITRINE_TYPES, WIZARD_VITRINE_TYPES } from './vitrine-types'

it('padrões por tipo de vitrine', () => {
  expect(VITRINE_TYPES).toEqual(['produtos', 'servicos', 'comida'])
  // O assistente só oferece produtos e serviços; 'comida' segue válido no banco para vitrines antigas.
  expect(WIZARD_VITRINE_TYPES).toEqual(['produtos', 'servicos'])
  expect(DEFAULT_BUTTON_TEXT).toEqual({ produtos: 'Adicionar à sacola', servicos: 'Quero esse serviço', comida: 'Pedir' })
  expect(SAMPLE_CATEGORIES.produtos).toEqual(['Destaques', 'Novidades'])
  expect(SAMPLE_CATEGORIES.servicos).toEqual(['Serviços', 'Pacotes'])
})

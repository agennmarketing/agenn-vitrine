import { expect, it } from 'vitest'
import { DEFAULT_BUTTON_TEXT, SAMPLE_CATEGORIES, VITRINE_TYPES, WIZARD_VITRINE_TYPES } from './vitrine-types'

it('padrões por tipo de vitrine', () => {
  expect(VITRINE_TYPES).toEqual(['produtos', 'servicos', 'comida'])
  // O assistente cria serviços e produtos; 'comida' segue válido no banco.
  expect(WIZARD_VITRINE_TYPES).toEqual(['servicos', 'produtos'])
  expect(DEFAULT_BUTTON_TEXT).toEqual({ produtos: 'Adicionar à sacola', servicos: 'Agendar horário', comida: 'Pedir' })
  expect(SAMPLE_CATEGORIES.produtos).toEqual(['Destaques', 'Novidades'])
  expect(SAMPLE_CATEGORIES.servicos).toEqual(['Serviços', 'Pacotes'])
})

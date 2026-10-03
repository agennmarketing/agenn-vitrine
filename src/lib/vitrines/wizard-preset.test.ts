import { describe, expect, it } from 'vitest'
import { PERSONAS } from '@/app/site/_vendas/personas'
import { validPerfil, wizardPresetFor } from './wizard-preset'

describe('wizardPresetFor', () => {
  it('manicure entra em serviços com o ramo de unhas', () => {
    expect(wizardPresetFor('manicure')).toEqual({ type: 'servicos', segment: 'nail' })
  })

  it('afiliado entra em produtos no modo afiliado', () => {
    expect(wizardPresetFor('afiliado')).toEqual({ type: 'produtos', productMode: 'afiliado' })
  })

  it('cada página de negócio tem o seu preset, do mesmo tipo da demonstração', () => {
    for (const persona of PERSONAS) {
      const preset = wizardPresetFor(persona.slug)
      expect(preset, persona.slug).not.toBeNull()
      expect(preset?.type, persona.slug).toBe(persona.demo.kind === 'servicos' ? 'servicos' : 'produtos')
    }
  })

  it('o nome antigo da página de cabeleireira continua valendo', () => {
    expect(wizardPresetFor('cabeleireiro')).toEqual(wizardPresetFor('cabeleireira'))
  })

  it('ignora perfis desconhecidos e valores que não são texto', () => {
    expect(wizardPresetFor('qualquer')).toBeNull()
    expect(wizardPresetFor('toString')).toBeNull()
    expect(wizardPresetFor(undefined)).toBeNull()
    expect(validPerfil(['manicure'])).toBeNull()
  })
})

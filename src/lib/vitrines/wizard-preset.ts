import type { ServiceSegment } from './service-segments'
import type { ProductMode } from './vitrine-types'

/*
 * Quem chega pela página de um negócio (vitrimove.site/manicure...) entra no assistente com
 * o tipo e o ramo já escolhidos. O perfil viaja como ?perfil= até o cadastro e fica guardado
 * na conta, porque a confirmação do e-mail pode abrir em outro aparelho.
 */
export type WizardPreset =
  | { type: 'servicos'; segment: ServiceSegment }
  | { type: 'produtos'; productMode: ProductMode }

const PRESETS: Record<string, WizardPreset> = {
  manicure: { type: 'servicos', segment: 'nail' },
  cabeleireira: { type: 'servicos', segment: 'cabelo' },
  // Nome antigo da página de cabeleireira: pode estar guardado em contas criadas antes da troca.
  cabeleireiro: { type: 'servicos', segment: 'cabelo' },
  barbearia: { type: 'servicos', segment: 'barbearia' },
  lash: { type: 'servicos', segment: 'lash' },
  sobrancelha: { type: 'servicos', segment: 'sobrancelha' },
  estetica: { type: 'servicos', segment: 'estetica' },
  loja: { type: 'produtos', productMode: 'proprios' },
  afiliado: { type: 'produtos', productMode: 'afiliado' },
}

/** O perfil, se for um dos conhecidos; qualquer outro valor vira nulo. */
export function validPerfil(value: unknown): string | null {
  return typeof value === 'string' && Object.hasOwn(PRESETS, value) ? value : null
}

export function wizardPresetFor(perfil: unknown): WizardPreset | null {
  const slug = validPerfil(perfil)
  return slug ? PRESETS[slug] : null
}

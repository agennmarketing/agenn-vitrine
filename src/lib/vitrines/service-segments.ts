// Segmento do negócio de serviços, escolhido no primeiro passo do assistente.
// Só personaliza textos e exemplos da interface: toda vitrine continua do tipo 'servicos'.
export const SERVICE_SEGMENTS = ['nail', 'cabelo', 'lash', 'sobrancelha', 'barbearia', 'estetica', 'outro'] as const
export type ServiceSegment = (typeof SERVICE_SEGMENTS)[number]

export type SegmentCopy = {
  label: string
  /** Exemplo do nome do negócio no assistente. */
  businessName: string
  /** Exemplo do endereço (subdomínio) no assistente. */
  subdomain: string
  /** Exemplo de serviço no cadastro de itens. */
  serviceExample: string
  /** Categorias criadas junto com a vitrine. */
  categories: readonly string[]
}

export const SEGMENT_COPY: Record<ServiceSegment, SegmentCopy> = {
  nail: {
    label: 'Nail Designer / Manicure',
    businessName: 'Studio Ana Nails',
    subdomain: 'ananails',
    serviceExample: 'Alongamento em gel',
    categories: ['Mãos', 'Pés'],
  },
  cabelo: {
    label: 'Cabeleireiro(a) / Salão',
    businessName: 'Salão da Bia',
    subdomain: 'salaodabia',
    serviceExample: 'Corte e escova',
    categories: ['Cortes', 'Coloração', 'Tratamentos'],
  },
  lash: {
    label: 'Lash Designer',
    businessName: 'Ana Lash Studio',
    subdomain: 'analash',
    serviceExample: 'Volume brasileiro',
    categories: ['Extensão de cílios', 'Manutenção'],
  },
  sobrancelha: {
    label: 'Designer de Sobrancelhas',
    businessName: 'Bia Sobrancelhas',
    subdomain: 'biasobrancelhas',
    serviceExample: 'Design com henna',
    categories: ['Design', 'Micropigmentação'],
  },
  barbearia: {
    label: 'Barbearia',
    businessName: 'Barbearia do Zé',
    subdomain: 'barbeariadoze',
    serviceExample: 'Corte + barba',
    categories: ['Cortes', 'Barba'],
  },
  estetica: {
    label: 'Estética',
    businessName: 'Clínica Bem Estar',
    subdomain: 'clinicabemestar',
    serviceExample: 'Limpeza de pele',
    categories: ['Facial', 'Corporal'],
  },
  outro: {
    label: 'Outro',
    businessName: 'Studio da Ana',
    subdomain: 'studiodaana',
    serviceExample: 'Atendimento',
    categories: ['Serviços', 'Pacotes'],
  },
}

export function isServiceSegment(value: unknown): value is ServiceSegment {
  return typeof value === 'string' && (SERVICE_SEGMENTS as readonly string[]).includes(value)
}

// Horários de atendimento: um item por dia aberto (0 = domingo).
export type BusinessHours = { day: number; open: string; close: string }[]

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

export const DEFAULT_BUSINESS_HOURS: BusinessHours = [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '09:00', close: '18:00' }))

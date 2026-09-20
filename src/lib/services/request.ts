/*
 * Vitrine de serviços: no lugar da sacola, o cliente pede o serviço numa etapa curta
 * (nome, data e horário desejados, observação) e a mensagem sai pronta no WhatsApp.
 * Nada aqui reserva horário — a combinação continua sendo feita na conversa.
 */
export type ServiceRequestInput = { name: string; date: string; time: string; notes: string }

export type ServiceRequestValue = { name: string; date: string | null; time: string | null; notes: string | null }

export type ServiceRequestErrors = Partial<Record<keyof ServiceRequestInput, string>>

export const EMPTY_SERVICE_REQUEST: ServiceRequestInput = { name: '', date: '', time: '', notes: '' }

export function validateServiceRequest(
  input: ServiceRequestInput,
  today: string,
): { ok: true; value: ServiceRequestValue } | { ok: false; errors: ServiceRequestErrors } {
  const errors: ServiceRequestErrors = {}

  const name = input.name.trim()
  if (!name) errors.name = 'Informe seu nome.'
  else if (name.length > 60) errors.name = 'Use até 60 caracteres.'

  // Data e horário são opcionais: só são conferidos quando o cliente preenche.
  const date = input.date.trim()
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Informe a data.'
    else if (date < today) errors.date = 'Escolha uma data a partir de hoje.'
  }

  const time = input.time.trim()
  if (time && !/^\d{2}:\d{2}$/.test(time)) errors.time = 'Informe o horário.'

  const notes = input.notes.trim()
  if (notes.length > 300) errors.notes = 'Use até 300 caracteres.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { name, date: date || null, time: time || null, notes: notes || null } }
}

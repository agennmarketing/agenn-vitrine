import { parseBRLToCents } from '@/lib/money/money'
import { normalizePhone } from '@/lib/whatsapp/phone'

export type FieldMode = 'off' | 'optional' | 'required'

export type CheckoutSettings = {
  nameMode: FieldMode
  phoneMode: FieldMode
  fulfillmentMode: FieldMode
  allowPickup: boolean
  allowDelivery: boolean
  paymentMode: FieldMode
  scheduleMode: FieldMode
  notesMode: FieldMode
  paymentOptions: string[]
  extraNote: string | null
}

export type CheckoutInput = {
  name: string
  phone: string
  fulfillment: string
  address: string
  payment: string
  changeFor: string
  date: string
  time: string
  notes: string
}

export type CheckoutValue = {
  name: string | null
  phone: string | null
  fulfillment: 'retirada' | 'entrega' | null
  address: string | null
  payment: string | null
  changeForCents: number | null
  schedule: { date: string; time: string } | null
  notes: string | null
}

export const EMPTY_CHECKOUT_INPUT: CheckoutInput = {
  name: '', phone: '', fulfillment: '', address: '', payment: '', changeFor: '', date: '', time: '', notes: '',
}

/** Retirada e entrega que o negócio aceita, na ordem em que aparecem. */
export function fulfillmentOptions(settings: CheckoutSettings): ('retirada' | 'entrega')[] {
  const options: ('retirada' | 'entrega')[] = []
  if (settings.allowPickup) options.push('retirada')
  if (settings.allowDelivery) options.push('entrega')
  return options
}

export const CASH_OPTION = 'Dinheiro'

export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function validateCheckout(
  settings: CheckoutSettings,
  input: CheckoutInput,
  today: string,
): { ok: true; value: CheckoutValue } | { ok: false; errors: Partial<Record<keyof CheckoutInput, string>> } {
  const errors: Partial<Record<keyof CheckoutInput, string>> = {}
  const value: CheckoutValue = {
    name: null, phone: null, fulfillment: null, address: null, payment: null, changeForCents: null, schedule: null, notes: null,
  }

  if (settings.nameMode !== 'off') {
    const name = input.name.trim()
    if (!name && settings.nameMode === 'required') errors.name = 'Informe seu nome.'
    else if (name.length > 60) errors.name = 'Use até 60 caracteres.'
    else value.name = name || null
  }

  if (settings.phoneMode !== 'off') {
    const phone = input.phone.trim()
    if (!phone) {
      if (settings.phoneMode === 'required') errors.phone = 'Informe seu telefone.'
    } else {
      const normalized = normalizePhone(phone)
      if (!normalized) errors.phone = 'Informe um telefone válido com DDD.'
      else value.phone = normalized
    }
  }

  if (settings.fulfillmentMode !== 'off') {
    const allowed = fulfillmentOptions(settings)
    const fulfillment = input.fulfillment
    if (fulfillment !== 'retirada' && fulfillment !== 'entrega') {
      if (settings.fulfillmentMode === 'required') errors.fulfillment = 'Escolha retirada ou entrega.'
    } else if (!allowed.includes(fulfillment)) {
      errors.fulfillment = 'Escolha uma opção disponível.'
    } else {
      value.fulfillment = fulfillment
      if (fulfillment === 'entrega') {
        const address = input.address.trim()
        if (!address) errors.address = 'Informe o endereço de entrega.'
        else if (address.length > 200) errors.address = 'Use até 200 caracteres.'
        else value.address = address
      }
    }
  }

  if (settings.paymentMode !== 'off') {
    const payment = input.payment.trim()
    if (!payment) {
      if (settings.paymentMode === 'required') errors.payment = 'Escolha a forma de pagamento.'
    } else if (!settings.paymentOptions.includes(payment)) {
      errors.payment = 'Escolha uma forma de pagamento da lista.'
    } else {
      value.payment = payment
      if (payment === CASH_OPTION && input.changeFor.trim()) {
        const cents = parseBRLToCents(input.changeFor)
        if (cents === null) errors.changeFor = 'Valor inválido. Ex.: 50,00'
        else value.changeForCents = cents
      }
    }
  }

  if (settings.scheduleMode !== 'off') {
    const date = input.date.trim()
    const time = input.time.trim()
    if (date || time || settings.scheduleMode === 'required') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Informe a data.'
      else if (date < today) errors.date = 'Escolha uma data a partir de hoje.'
      if (!/^\d{2}:\d{2}$/.test(time)) errors.time = 'Informe o horário.'
      if (!errors.date && !errors.time) value.schedule = { date, time }
    }
  }

  if (settings.notesMode !== 'off') {
    const notes = input.notes.trim()
    if (!notes && settings.notesMode === 'required') errors.notes = 'Escreva a observação.'
    else if (notes.length > 300) errors.notes = 'Use até 300 caracteres.'
    else value.notes = notes || null
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value }
}

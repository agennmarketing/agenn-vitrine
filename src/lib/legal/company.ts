// Único lugar com os dados da empresa (conforme o cartão CNPJ).
export const COMPANY = {
  legalName: 'DELIVIZE TECNOLOGIA DA INFORMACAO LTDA',
  tradeName: 'Vitrimove',
  cnpj: '58.075.267/0001-28',
  address: 'Av. Paulista, 1106, Sala 01, Andar 16, Bela Vista, São Paulo/SP, CEP 01310-914',
  contactEmail: 'suporte@vitrimove.site',
  privacyEmail: 'privacidade@vitrimove.site',
}

// Mudou o texto? Mude a data. É ela que aparece como "Última atualização".
export const LEGAL_VERSION = '2026-09-30'

const [ano, mes, dia] = LEGAL_VERSION.split('-')
export const LEGAL_VERSION_LABEL = `${dia}/${mes}/${ano}`

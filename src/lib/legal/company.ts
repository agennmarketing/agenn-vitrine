// Único lugar com os dados da empresa. Enquanto estiver com "A PREENCHER", os
// textos legais não estão prontos para o lançamento.
export const COMPANY = {
  legalName: 'A PREENCHER — razão social',
  tradeName: 'Agenn',
  cnpj: 'A PREENCHER — 00.000.000/0001-00',
  address: 'A PREENCHER — endereço completo',
  contactEmail: 'suporte@agenn.com.br',
  privacyEmail: 'privacidade@agenn.com.br',
}

// Mudou o texto? Mude a data. É ela que aparece como "Última atualização".
export const LEGAL_VERSION = '2026-09-20'

const [ano, mes, dia] = LEGAL_VERSION.split('-')
export const LEGAL_VERSION_LABEL = `${dia}/${mes}/${ano}`

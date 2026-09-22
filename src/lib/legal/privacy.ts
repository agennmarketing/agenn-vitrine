import { COMPANY } from './company'
import type { LegalSection } from './terms'

// Rascunho para revisão jurídica. Mudou aqui, mude LEGAL_VERSION em company.ts.
export const PRIVACY: LegalSection[] = [
  {
    title: '1. Quem trata seus dados',
    paragraphs: [
      `O controlador dos dados é ${COMPANY.legalName}, CNPJ ${COMPANY.cnpj}, com endereço em ${COMPANY.address}, responsável pelo serviço ${COMPANY.tradeName}.`,
      `Para falar sobre privacidade, inclusive para exercer seus direitos, escreva para ${COMPANY.privacyEmail}.`,
    ],
  },
  {
    title: '2. Quais dados tratamos',
    paragraphs: [
      'Da pessoa que cria a conta: nome, e-mail e senha (guardada apenas de forma criptografada pelo Supabase). Se você entra com o Google, recebemos nome e e-mail da sua conta Google.',
      'Do uso do serviço: vitrines, itens, fotos, vídeos, textos e configurações que você cria, além de registros técnicos como data de acesso e erros.',
      'De pagamento: a assinatura é processada pela Stripe. Guardamos apenas identificadores da assinatura e do cliente, o status, o intervalo e a data de renovação. Não guardamos número de cartão.',
      'Do visitante da vitrine: não guardamos nome, telefone, endereço nem forma de pagamento. Esses dados são digitados no navegador do visitante e seguem direto na mensagem do WhatsApp para você. O que fica salvo é o resumo do pedido (itens, quantidades e preços do momento), sem dados pessoais.',
      'Para limitar abuso, guardamos o endereço IP do visitante apenas em forma de código embaralhado (hash), que não permite voltar ao IP original, por até 2 dias.',
    ],
  },
  {
    title: '3. Por que tratamos e com qual base legal',
    paragraphs: [
      'Para criar e manter sua conta, publicar suas vitrines e cobrar a assinatura: execução do contrato (art. 7º, V, da LGPD).',
      'Para emitir documentos fiscais e guardar registros exigidos por lei: cumprimento de obrigação legal (art. 7º, II).',
      'Para segurança, prevenção a fraude e melhoria do serviço: legítimo interesse (art. 7º, IX), sempre com o menor dado possível.',
    ],
  },
  {
    title: '4. Cookies e dados guardados no aparelho',
    paragraphs: [
      'Usamos cookies necessários para manter você conectado ao painel. Não usamos cookies de publicidade.',
      'Na vitrine, a sacola do visitante fica guardada apenas no navegador dele (armazenamento local), nunca no nosso servidor, e some quando ele limpa os dados do navegador.',
    ],
  },
  {
    title: '5. Com quem compartilhamos',
    paragraphs: [
      'Usamos empresas que nos ajudam a operar o serviço, cada uma com acesso apenas ao necessário: Supabase (banco de dados e autenticação), Vercel (hospedagem do site), Bunny (armazenamento e entrega de imagens), Mux (armazenamento e entrega de vídeos), Stripe (pagamentos), Resend (envio de e-mails), Cloudflare (proteção contra robôs e DNS) e Google (apenas se você escolher entrar com o Google).',
      'Parte desses serviços fica fora do Brasil, então pode haver transferência internacional de dados, feita com as garantias previstas na LGPD.',
      'Não vendemos seus dados nem os de seus clientes.',
    ],
  },
  {
    title: '6. Por quanto tempo guardamos',
    paragraphs: [
      'Dados da conta e conteúdo publicado: enquanto a conta existir.',
      'Resumos de pedido do simulador: 90 dias, depois são apagados automaticamente.',
      'Conta com o teste grátis encerrado ou a assinatura cancelada: os dados continuam guardados até você excluir a conta.',
      'Registros fiscais e de cobrança: pelo prazo exigido pela legislação, mesmo após a exclusão da conta.',
    ],
  },
  {
    title: '7. Excluir a conta',
    paragraphs: [
      'Você pode excluir sua conta a qualquer momento no painel, em Conta → Excluir conta. Isso cancela a assinatura, apaga suas vitrines, itens, fotos e vídeos e remove seus dados de acesso. A ação não pode ser desfeita.',
    ],
  },
  {
    title: '8. Seus direitos',
    paragraphs: [
      'A LGPD garante a você: confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão, portabilidade, informação sobre com quem compartilhamos e revisão de decisões automatizadas.',
      `Boa parte disso está no próprio painel. Para o resto, escreva para ${COMPANY.privacyEmail}; respondemos em até 15 dias.`,
    ],
  },
  {
    title: '9. Segurança',
    paragraphs: [
      'As conexões usam HTTPS, as senhas ficam criptografadas e o banco de dados tem regras que impedem uma conta de acessar os dados de outra. Nenhum sistema é totalmente imune: se acontecer um incidente relevante, avisamos você e a Autoridade Nacional de Proteção de Dados.',
    ],
  },
  {
    title: '10. Crianças e adolescentes',
    paragraphs: ['O serviço é destinado a maiores de 18 anos e não é dirigido a crianças e adolescentes.'],
  },
  {
    title: '11. Mudanças nesta política',
    paragraphs: [
      'Podemos atualizar esta política. A data da última atualização fica no topo da página e mudanças relevantes são avisadas por e-mail ou no painel.',
    ],
  },
]

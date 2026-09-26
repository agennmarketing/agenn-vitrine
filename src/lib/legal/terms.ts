import { COMPANY } from './company'

export type LegalSection = { title: string; paragraphs: string[] }

// Rascunho para revisão jurídica. Mudou aqui, mude LEGAL_VERSION em company.ts.
export const TERMS: LegalSection[] = [
  {
    title: '1. Quem somos',
    paragraphs: [
      `O ${COMPANY.tradeName} é um serviço de ${COMPANY.legalName}, inscrita no CNPJ ${COMPANY.cnpj}, com endereço em ${COMPANY.address}.`,
      `O serviço permite criar vitrines e catálogos na internet, com fotos e vídeos, e receber pedidos e orçamentos pelo WhatsApp. Ao criar uma conta, você concorda com estes Termos de uso. Dúvidas: ${COMPANY.contactEmail}.`,
    ],
  },
  {
    title: '2. Conta e acesso',
    paragraphs: [
      'Para usar o serviço é preciso ter 18 anos ou mais, informar dados verdadeiros e confirmar o e-mail.',
      'Cada conta é usada em um aparelho por vez: ao entrar em um novo aparelho, a sessão anterior é encerrada. Você é responsável por manter sua senha em segredo e por tudo que acontece na sua conta.',
      'Você pode encerrar sua conta quando quiser, pelo painel, em Conta → Excluir conta.',
    ],
  },
  {
    title: '3. Planos, preços e pagamento',
    paragraphs: [
      'Existe um único plano, o Plano Essencial. Os limites dele estão descritos no painel e podem mudar; mudanças que reduzam limites de um plano já contratado são avisadas com antecedência.',
      'Toda conta nova começa com um teste grátis de 7 dias, com todas as funções do Plano Essencial. Não pedimos cartão para começar o teste, e ele não vira cobrança sozinho.',
      'O Plano Essencial custa R$ 69,90 por mês, com renovação automática ao fim de cada mês, até que você cancele. O pagamento é feito com cartão de crédito, processado pela Stripe; não temos acesso ao número do seu cartão.',
      'Reajustes de preço são avisados por e-mail com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte.',
      'Se a cobrança falhar, tentamos novamente por até 7 dias. Nesse período a assinatura continua valendo. Sem sucesso, a assinatura é cancelada e o acesso fica pausado, como descrito a seguir.',
    ],
  },
  {
    title: '4. Cancelamento e arrependimento',
    paragraphs: [
      'Você pode cancelar quando quiser pelo painel, em Plano e assinatura → Gerenciar assinatura. O cancelamento vale no fim do período já pago, e não há cobrança depois disso.',
      'Fora do prazo de arrependimento, não há devolução proporcional do período já pago.',
      'Se a contratação foi feita pela internet, você pode desistir em até 7 dias corridos, contados da contratação, com devolução integral do valor pago (art. 49 do Código de Defesa do Consumidor). Basta pedir por ' +
        COMPANY.contactEmail +
        '.',
    ],
  },
  {
    title: '5. O que acontece quando o teste ou a assinatura acaba',
    paragraphs: [
      'Se o teste grátis terminar sem assinatura, ou se a assinatura for cancelada, o acesso fica pausado: o painel mostra só a tela de assinatura, a vitrine sai do ar e deixa de receber agendamentos.',
      'Nada é apagado. Sua vitrine, seus serviços, fotos, vídeos e sua agenda continuam guardados, e tudo volta a funcionar assim que você assinar o Plano Essencial. Para apagar seus dados, use Conta → Excluir conta.',
    ],
  },
  {
    title: '6. Seu conteúdo',
    paragraphs: [
      'O conteúdo que você publica é seu. Você nos concede apenas a autorização necessária para hospedar, converter e exibir esse conteúdo na sua vitrine enquanto sua conta existir.',
      'Você é o único responsável pelo que publica: preços, descrições, fotos, vídeos, disponibilidade e pelo cumprimento do que oferece. Garante também que tem os direitos sobre as imagens e vídeos que envia.',
      'Não é permitido publicar conteúdo ilegal, enganoso, que viole direitos de terceiros, nem produtos e serviços proibidos por lei ou pelas regras dos serviços que usamos, incluindo armas, drogas, medicamentos controlados, conteúdo adulto e jogos de azar.',
    ],
  },
  {
    title: '7. Uso do serviço',
    paragraphs: [
      'Cada conta tem uma franquia mensal de entrega de vídeo. Ao ultrapassá-la, os vídeos deixam de tocar e a vitrine passa a mostrar apenas as fotos até o mês virar; nada é apagado.',
      'Não é permitido tentar burlar limites do plano, acessar dados de outras contas, sobrecarregar o serviço ou usá-lo para enviar mensagens não solicitadas.',
    ],
  },
  {
    title: '8. Pedidos são entre você e seu cliente',
    paragraphs: [
      `O ${COMPANY.tradeName} monta a mensagem e abre o WhatsApp. A negociação, o pagamento, a entrega e o atendimento acontecem diretamente entre você e seu cliente: não somos parte do negócio, não processamos pagamentos de pedidos e não intermediamos entregas.`,
      'O código de pedido serve apenas para você conferir, no painel, o que foi enviado.',
    ],
  },
  {
    title: '9. Disponibilidade e suporte',
    paragraphs: [
      'Trabalhamos para manter o serviço disponível, mas ele pode ficar fora do ar por manutenção, falha de terceiros ou motivos fora do nosso controle. Não oferecemos garantia de tempo de disponibilidade.',
      `O suporte é feito por e-mail, em ${COMPANY.contactEmail}, em dias úteis.`,
    ],
  },
  {
    title: '10. Suspensão e encerramento',
    paragraphs: [
      'Podemos suspender ou encerrar contas que violem estes Termos ou a lei, de preferência após aviso, e imediatamente em casos graves.',
      'Se encerrarmos sua conta sem que você tenha dado causa, devolvemos a parte proporcional do período já pago.',
    ],
  },
  {
    title: '11. Responsabilidade',
    paragraphs: [
      'Respondemos por danos diretos comprovados, limitados ao valor pago por você nos 12 meses anteriores ao fato.',
      'Não respondemos por lucros cessantes, perda de clientes, nem por conteúdo, produtos ou serviços oferecidos por você ou por terceiros. Nada aqui afasta direitos que o Código de Defesa do Consumidor garanta a você.',
    ],
  },
  {
    title: '12. Propriedade intelectual da plataforma',
    paragraphs: [
      `A marca ${COMPANY.tradeName}, o software e o material da plataforma pertencem a ${COMPANY.legalName}. Sua assinatura dá direito de uso do serviço, não de cópia, revenda ou engenharia reversa.`,
    ],
  },
  {
    title: '13. Mudanças nestes Termos',
    paragraphs: [
      'Podemos alterar estes Termos. Mudanças relevantes são avisadas por e-mail ou no painel com pelo menos 30 dias de antecedência. Continuar usando o serviço depois disso significa concordar com a nova versão.',
    ],
  },
  {
    title: '14. Lei aplicável e foro',
    paragraphs: [
      'Estes Termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do consumidor para resolver questões que não se resolvam de forma amigável.',
    ],
  },
]

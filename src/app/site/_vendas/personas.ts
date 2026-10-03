// Perfis da página de vendas: cada negócio tem a sua página (vitrimove.site/<slug>), com texto,
// dores e vitrine de exemplo só dele. As vitrines do celular são inventadas (nomes, preços e
// horários) e aparecem rotuladas como exemplo; nada aqui é cliente real.

export type DemoService = { name: string; price: string; duration: string }
export type DemoProduct = { name: string; price: string; store?: string }

export type PersonaKind = 'servicos' | 'loja' | 'afiliado'

export type Persona = {
  slug: string
  /** Rótulo da opção na pergunta "O que você faz?". */
  label: string
  /** Para quem é, no plural ("manicures e nail designers"): título da aba e selo do topo. */
  audience: string
  group: 'servicos' | 'produtos'
  /** Figurino do Vitri (arquivo em /public/site). */
  vitri: string
  title: string
  pitch: string
  /** Título da seção das dores. */
  painsTitle: string
  /** O que o cliente pergunta hoje no direct, e como a vitrine responde. */
  pains: { ask: string; answer: string }[]
  closing: string
  faq: { q: string; a: string }[]
  metaDescription: string
  demo: {
    store: string
    subdomain: string
    /** Cor do lojista: a vitrine de exemplo mostra que cada negócio tem a sua. */
    color: string
    initials: string
    tagline: string
  } & (
    | { kind: 'servicos'; services: DemoService[]; pros?: string[]; slots: { time: string; busy?: boolean }[]; picked: string }
    | { kind: 'loja'; products: DemoProduct[]; bag: { count: number; total: string } }
    | { kind: 'afiliado'; products: DemoProduct[] }
  )
}

export const PERSONAS: Persona[] = [
  {
    slug: 'manicure',
    label: 'Manicure e nail designer',
    audience: 'manicures e nail designers',
    group: 'servicos',
    vitri: '/site/vitri-manicure.webp',
    title: 'Sua agenda de unhas cheia, sem viver no direct.',
    pitch:
      'Seus serviços com foto, preço e duração. A cliente escolhe um horário livre e já sai confirmada, enquanto você está com o alicate na mão.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Quanto custa o alongamento em fibra?', answer: 'Cada serviço aparece com foto, preço e duração. Ela já chega sabendo.' },
      { ask: 'Tem horário no sábado de manhã?', answer: 'Ela vê só os horários livres e escolhe sozinha, sem esperar você responder.' },
      { ask: 'Ops, marquei duas no mesmo horário…', answer: 'Horário marcado sai da lista na hora. Não tem como encavalar.' },
    ],
    closing: 'Bora encher a sua agenda?',
    faq: [
      {
        q: 'Dá para mostrar fotos dos meus trabalhos?',
        a: 'Sim. Cada serviço tem uma foto de capa e mais duas, para a cliente ver o acabamento antes de marcar.',
      },
      {
        q: 'E manutenção, que varia de preço?',
        a: 'Você pode mostrar "a partir de" ou "sob consulta" no lugar do preço fixo.',
      },
    ],
    metaDescription:
      'Vitrine on-line para manicures e nail designers: serviços com foto e preço, e a cliente marca o horário sozinha, confirmado na hora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Studio Bia Nails',
      subdomain: 'bianails',
      color: '#c2255c',
      initials: 'BN',
      tagline: 'Unhas em gel e fibra',
      services: [
        { name: 'Esmaltação em gel', price: 'R$ 60,00', duration: '1h' },
        { name: 'Alongamento em fibra', price: 'R$ 150,00', duration: '2h30' },
        { name: 'Manutenção', price: 'a partir de R$ 90,00', duration: '1h30' },
      ],
      slots: [
        { time: '09:00', busy: true },
        { time: '09:30' },
        { time: '10:00' },
        { time: '10:30', busy: true },
        { time: '11:00' },
        { time: '11:30' },
      ],
      picked: '10:00',
    },
  },
  {
    slug: 'cabeleireiro',
    label: 'Cabeleireiro e salão',
    audience: 'cabeleireiros e salões',
    group: 'servicos',
    vitri: '/site/vitri-cabeleireira.webp',
    title: 'Seu salão com agenda on-line, cada profissional no seu horário.',
    pitch:
      'A cliente escolhe o serviço, com quem quer fazer e o horário livre daquela pessoa. Tudo confirmado na hora, sem recepção e sem caderninho.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Dá pra fazer com a Carla?', answer: 'Cada profissional aparece com os serviços que faz e os horários dela.' },
      { ask: 'Quanto tempo leva a coloração?', answer: 'Cada serviço tem a sua duração, e a agenda só oferece o horário em que ele cabe.' },
      { ask: 'Vocês abrem segunda?', answer: 'Você define os dias e horários de atendimento, e os bloqueios de feriado e folga.' },
    ],
    closing: 'Bora encher a agenda do salão?',
    faq: [
      {
        q: 'Cada profissional pode ter um horário diferente?',
        a: 'Pode. Sem horário próprio, vale o do salão; com horário próprio, a agenda dela segue o que você definir.',
      },
      {
        q: 'A cliente pode escolher a profissional primeiro?',
        a: 'Pode. Ela toca na profissional e vê só os serviços que ela faz.',
      },
    ],
    metaDescription:
      'Agenda on-line para salões de beleza: a cliente escolhe o serviço, a profissional e o horário livre, confirmado na hora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Salão Raiz',
      subdomain: 'salaoraiz',
      color: '#7c2d12',
      initials: 'SR',
      tagline: 'Corte, cor e escova',
      services: [
        { name: 'Escova', price: 'R$ 60,00', duration: '1h' },
        { name: 'Corte feminino', price: 'R$ 90,00', duration: '1h' },
        { name: 'Coloração', price: 'a partir de R$ 180,00', duration: '3h' },
      ],
      pros: ['Carla', 'Ju', 'Neide'],
      slots: [
        { time: '14:00' },
        { time: '14:30', busy: true },
        { time: '15:00', busy: true },
        { time: '15:30' },
        { time: '16:00' },
        { time: '16:30' },
      ],
      picked: '15:30',
    },
  },
  {
    slug: 'barbearia',
    label: 'Barbearia',
    audience: 'barbearias',
    group: 'servicos',
    vitri: '/site/vitri-cabeleireira.webp',
    title: 'O cliente marca o corte sozinho. Você só corta.',
    pitch:
      'Corte, barba e combo com preço e duração. O cliente escolhe o barbeiro e o horário livre, e o agendamento cai confirmado na sua agenda.',
    painsTitle: 'Chega de parar o corte para responder',
    pains: [
      { ask: 'Tem horário agora à tarde?', answer: 'Ele vê na hora quais horários estão livres e marca sozinho.' },
      { ask: 'Quero cortar com o Rafa.', answer: 'Cada barbeiro tem os seus serviços e a sua agenda. O cliente escolhe com quem.' },
      { ask: 'Chegaram dois no mesmo horário…', answer: 'Horário marcado sai da lista na hora. Sem fila e sem confusão.' },
    ],
    closing: 'Bora lotar a cadeira?',
    faq: [
      {
        q: 'Funciona com mais de um barbeiro?',
        a: 'Funciona. Cada um tem os serviços que faz e, se quiser, horários próprios. Sem barbeiro cadastrado, é um atendimento por vez.',
      },
      {
        q: 'E se eu quiser fechar um horário para almoço ou folga?',
        a: 'Você bloqueia o horário na Agenda e ele some da vitrine.',
      },
    ],
    metaDescription:
      'Agendamento on-line para barbearias: o cliente escolhe corte, barbeiro e horário livre, confirmado na hora, sem dupla reserva. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Barbearia do Léo',
      subdomain: 'barbeariadoleo',
      color: '#0f766e',
      initials: 'BL',
      tagline: 'Corte e barba no centro',
      services: [
        { name: 'Corte masculino', price: 'R$ 45,00', duration: '40 min' },
        { name: 'Barba', price: 'R$ 35,00', duration: '30 min' },
        { name: 'Corte + barba', price: 'R$ 70,00', duration: '1h10' },
      ],
      pros: ['Léo', 'Rafa', 'Duda'],
      slots: [
        { time: '14:00' },
        { time: '14:30', busy: true },
        { time: '15:00', busy: true },
        { time: '15:30' },
        { time: '16:00' },
        { time: '16:30' },
      ],
      picked: '15:30',
    },
  },
  {
    slug: 'lash',
    label: 'Lash designer',
    audience: 'lash designers',
    group: 'servicos',
    vitri: '/site/vitri.webp',
    title: 'Sua agenda de cílios organizada, do volume à manutenção.',
    pitch:
      'Cada técnica com foto, preço e a duração certa. A cliente escolhe um horário livre que cabe no procedimento e já sai confirmada.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Quanto tempo leva o volume brasileiro?', answer: 'Cada técnica tem a sua duração, e a agenda só oferece o horário em que ela cabe.' },
      { ask: 'Tem horário para manutenção?', answer: 'Ela vê os horários livres da semana e marca sozinha.' },
      { ask: 'Preciso ir sem rímel?', answer: 'Cada serviço tem um aviso para a cliente ler antes de marcar.' },
    ],
    closing: 'Bora encher a sua agenda?',
    faq: [
      {
        q: 'Dá para mostrar fotos dos meus trabalhos?',
        a: 'Sim. Cada serviço tem uma foto de capa e mais duas, para a cliente ver o efeito antes de marcar.',
      },
      {
        q: 'Consigo evitar marcação em cima da hora?',
        a: 'Consegue. Você define a antecedência mínima e até quantos dias à frente dá para marcar.',
      },
    ],
    metaDescription:
      'Vitrine e agenda on-line para lash designers: técnicas com foto, preço e duração, e a cliente marca sozinha, confirmado na hora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Olhar Lash Studio',
      subdomain: 'olharlash',
      color: '#8a5a00',
      initials: 'OL',
      tagline: 'Extensão e lifting de cílios',
      services: [
        { name: 'Volume brasileiro', price: 'R$ 140,00', duration: '2h' },
        { name: 'Fio a fio', price: 'R$ 120,00', duration: '2h' },
        { name: 'Lash lifting', price: 'R$ 110,00', duration: '1h' },
      ],
      slots: [
        { time: '13:00' },
        { time: '13:30' },
        { time: '14:00', busy: true },
        { time: '14:30', busy: true },
        { time: '15:00' },
        { time: '15:30' },
      ],
      picked: '13:30',
    },
  },
  {
    slug: 'sobrancelha',
    label: 'Designer de sobrancelha',
    audience: 'designers de sobrancelha',
    group: 'servicos',
    vitri: '/site/vitri.webp',
    title: 'Sobrancelha marcada em segundos, direto pelo link.',
    pitch:
      'Design, henna e micropigmentação com foto e preço. A cliente escolhe o horário livre e o agendamento já sai confirmado.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Quanto fica com henna?', answer: 'Cada serviço aparece com foto, preço e duração.' },
      { ask: 'Tem horário hoje ainda?', answer: 'Ela vê na hora os horários livres e marca sozinha.' },
      { ask: 'A micro precisa de avaliação?', answer: 'Use "sob consulta" no preço e um aviso para a cliente ler antes de marcar.' },
    ],
    closing: 'Bora encher a sua agenda?',
    faq: [
      {
        q: 'Dá para mostrar o antes e depois?',
        a: 'Sim. Cada serviço tem uma foto de capa e mais duas.',
      },
      {
        q: 'E se eu atender em dois dias da semana só?',
        a: 'Você define os dias e horários de atendimento, e a vitrine só oferece esses.',
      },
    ],
    metaDescription:
      'Agenda on-line para designers de sobrancelha: serviços com foto e preço, e a cliente marca sozinha, confirmado na hora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Arco Sobrancelhas',
      subdomain: 'arcosobrancelhas',
      color: '#9f1239',
      initials: 'AS',
      tagline: 'Design e micropigmentação',
      services: [
        { name: 'Design de sobrancelha', price: 'R$ 45,00', duration: '40 min' },
        { name: 'Design com henna', price: 'R$ 60,00', duration: '50 min' },
        { name: 'Micropigmentação', price: 'sob consulta', duration: '2h30' },
      ],
      slots: [
        { time: '10:00' },
        { time: '10:30', busy: true },
        { time: '11:00' },
        { time: '11:30' },
        { time: '12:00', busy: true },
        { time: '12:30' },
      ],
      picked: '11:00',
    },
  },
  {
    slug: 'estetica',
    label: 'Estética e massagem',
    audience: 'clínicas de estética e massoterapeutas',
    group: 'servicos',
    vitri: '/site/vitri.webp',
    title: 'Seus procedimentos com hora marcada e cara de clínica.',
    pitch:
      'Limpeza de pele, drenagem, massagem: cada procedimento com preço e duração. A cliente escolhe o horário livre e já sai confirmada.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Quanto dura a drenagem?', answer: 'Cada procedimento mostra preço e duração, e a agenda respeita o tempo de cada um.' },
      { ask: 'Tem horário com a mesma profissional?', answer: 'A cliente escolhe com quem quer ser atendida e vê só os horários dela.' },
      { ask: 'Marcaram em cima da hora…', answer: 'Você define a antecedência mínima e o intervalo entre atendimentos.' },
    ],
    closing: 'Bora encher a sua agenda?',
    faq: [
      {
        q: 'Tenho uma equipe. Funciona?',
        a: 'Funciona. Cada profissional tem os procedimentos que faz e, se quiser, horários próprios.',
      },
      {
        q: 'Dá para deixar um tempo entre um atendimento e outro?',
        a: 'Dá. Você define o intervalo entre atendimentos, para arrumar a sala com calma.',
      },
    ],
    metaDescription:
      'Agenda on-line para estética e massagem: procedimentos com preço e duração, profissionais e horários livres, confirmado na hora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'servicos',
      store: 'Espaço Bem Leve',
      subdomain: 'bemleve',
      color: '#166534',
      initials: 'BL',
      tagline: 'Estética e massoterapia',
      services: [
        { name: 'Limpeza de pele', price: 'R$ 150,00', duration: '1h30' },
        { name: 'Drenagem linfática', price: 'R$ 120,00', duration: '1h' },
        { name: 'Massagem relaxante', price: 'R$ 130,00', duration: '1h' },
      ],
      pros: ['Ana', 'Bia'],
      slots: [
        { time: '09:00' },
        { time: '10:00', busy: true },
        { time: '11:00' },
        { time: '14:00' },
        { time: '15:00', busy: true },
        { time: '16:00' },
      ],
      picked: '11:00',
    },
  },
  {
    slug: 'loja',
    label: 'Loja de produtos',
    audience: 'lojas e quem vende produtos',
    group: 'produtos',
    vitri: '/site/vitri-produtos.webp',
    title: 'Sua loja no link da bio. O pedido chega pronto no WhatsApp.',
    pitch:
      'Seus produtos com foto e preço, numa vitrine com a sua cor. O cliente monta a sacola e toca em "Fazer pedido": a mensagem chega com tudo no seu WhatsApp.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Me manda o catálogo?', answer: 'Mande o link. Todos os produtos com foto, preço e categoria, sempre atualizados.' },
      { ask: 'Quanto fica tudo junto?', answer: 'A sacola soma as quantidades e mostra o total antes do pedido.' },
      { ask: 'Entrega ou retira? Paga como?', answer: 'O cliente já informa retirada ou entrega, endereço e forma de pagamento no pedido.' },
    ],
    closing: 'Bora vender pelo link?',
    faq: [
      {
        q: 'O cliente paga pela vitrine?',
        a: 'Não. O pedido chega no seu WhatsApp e você combina o pagamento direto com o cliente, como já faz.',
      },
      {
        q: 'Posso escolher o que o cliente informa no pedido?',
        a: 'Pode: nome, telefone, retirada ou entrega, endereço, forma de pagamento e observações. Você liga só o que precisa.',
      },
    ],
    metaDescription:
      'Catálogo on-line para lojas: produtos com foto e preço, sacola com total e pedido pronto no seu WhatsApp. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'loja',
      store: 'Ateliê Flor de Sal',
      subdomain: 'flordesal',
      color: '#2563eb',
      initials: 'FS',
      tagline: 'Velas e sabonetes artesanais',
      products: [
        { name: 'Vela aromática', price: 'R$ 49,90' },
        { name: 'Sabonete de argila', price: 'R$ 19,90' },
        { name: 'Difusor de varetas', price: 'R$ 69,90' },
        { name: 'Kit presente', price: 'R$ 119,90' },
      ],
      bag: { count: 2, total: 'R$ 69,80' },
    },
  },
  {
    slug: 'afiliado',
    label: 'Afiliado',
    audience: 'afiliados da Shopee, do Mercado Livre e da Amazon',
    group: 'produtos',
    vitri: '/site/vitri-afiliado.webp',
    title: 'Todos os seus achadinhos num link só.',
    pitch:
      'Shopee, Mercado Livre, Amazon: cada produto com foto, preço e o seu link de afiliado. O seguidor toca em "Comprar agora" e cai direto na loja.',
    painsTitle: 'Chega de responder isso o dia inteiro',
    pains: [
      { ask: 'Cadê o link daquele fone?', answer: 'Tudo fica na sua vitrine, separado por categoria e com busca.' },
      { ask: 'O story já sumiu…', answer: 'A vitrine não some em 24 horas. O link da bio leva sempre para ela.' },
      { ask: 'Só cabe um link na bio.', answer: 'Um link só, com todos os produtos e o botão "Comprar agora" de cada um.' },
    ],
    closing: 'Bora juntar seus achadinhos?',
    faq: [
      {
        q: 'Funciona com qualquer loja?',
        a: 'Funciona com qualquer link: Shopee, Mercado Livre, Amazon ou outra loja em que você seja afiliado.',
      },
      {
        q: 'Preciso de WhatsApp?',
        a: 'Não. Na vitrine de afiliado o cliente vai direto para a loja pelo seu link.',
      },
    ],
    metaDescription:
      'Vitrine de achadinhos para afiliados da Shopee, do Mercado Livre e da Amazon: todos os seus links num lugar só, com botão Comprar agora. 7 dias grátis, sem cartão.',
    demo: {
      kind: 'afiliado',
      store: 'Achadinhos da Mari',
      subdomain: 'achadinhosdamari',
      color: '#c2410c',
      initials: 'AM',
      tagline: 'Os melhores achados da semana',
      products: [
        { name: 'Fone sem fio', price: 'R$ 89,90', store: 'Shopee' },
        { name: 'Organizador de maquiagem', price: 'R$ 54,90', store: 'Mercado Livre' },
        { name: 'Garrafa térmica', price: 'R$ 79,90', store: 'Amazon' },
      ],
    },
  },
]

export function findPersona(slug: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.slug === slug)
}

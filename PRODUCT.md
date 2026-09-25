# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dono do negócio:** pequeno negócio brasileiro de serviços com hora marcada: nail designer, cabeleireiro, lash, sobrancelha, barbearia, estética. Quase sempre atende uma pessoa por vez. Não é técnico. Monta e mantém a vitrine e a agenda pelo celular, entre um atendimento e outro; às vezes pelo computador. Precisa sentir que está avançando e terminar rápido.
- **Cliente final:** abre a vitrine pelo link do Instagram/WhatsApp ou pelo QR Code, quase sempre no celular e em 4G. Quer ver o serviço, o preço e um horário livre, e agendar sem cadastro e sem trocar mensagens.

## Product Purpose

Agenn é um SaaS de vitrine com agenda online para negócios de serviços. O dono cadastra os serviços (fotos, preço, duração) e as regras de horário; o cliente abre o link, escolhe o serviço e um horário livre, e o agendamento sai confirmado na hora. Sucesso = o dono publica a vitrine sem ajuda e o cliente agenda sozinho, sem conflito de horário.

## Positioning

Vitrine bonita e agenda de verdade no mesmo link: o cliente vê o serviço e já marca o horário, confirmado na hora, sem app, sem cadastro e sem dupla reserva. Um plano só, simples de entender.

## Operating Context

- Três áreas: Acesso (`app.agenn.com.br`: cadastro, login, senha), Painel (`app.agenn.com.br/painel`) e Vitrine pública (`{subdominio}.agenn.com.br`).
- Uma vitrine por conta, sempre do tipo `servicos`. O assistente de criação tem 4 passos: segmento → nome e endereço da vitrine → WhatsApp, Instagram e endereço (opcionais) → horários de atendimento e aparência.
- O segmento (nail, cabelo, lash, sobrancelha, barbearia, estética, outro) só personaliza textos e exemplos; o sistema é o mesmo para todos.
- Painel, barra lateral: **Vitrine, Agenda, Plano, Conta**.
  - Vitrine: serviços (capa + 2 fotos, nome, descrição, categoria, preço fixo / a partir de / sob consulta, duração, aviso ao cliente, ativo/inativo), aparência (logo, banner, cor da marca, tema claro/escuro), WhatsApp, configurações e compartilhar (link e QR Code).
  - Agenda: abas Hoje, Próximos, Concluídos e Cancelados; concluir, remarcar e cancelar; regras de horário por dia, intervalo entre atendimentos, antecedência mínima, janela de dias e bloqueios avulsos.
  - Plano: situação da assinatura (teste grátis, ativo, vencido) e assinatura pelo Stripe.
  - Conta: dados de acesso e exclusão da conta.
- Vitrine pública: lista de serviços; "Agendar horário" abre a escolha de dia e horário livre (grade de 30 min, um atendimento por vez); confirmação na tela com botão opcional para avisar o negócio no WhatsApp.
- Aplicativo (PWA), opcional e sem loja de aplicativos: o dono pode instalar o painel no celular (abre em `/painel`, com atalhos para Vitrine e Agenda) e o cliente pode instalar a vitrine, que ganha o nome, a logo e a cor do negócio na tela de início. Sem internet, os dois mostram a tela "Sem conexão". Nada no produto exige instalar.
- O ícone da aba (favicon) da vitrine pública é a logo do negócio; sem logo, é o símbolo do Agenn.
- Fora da interface, mas ainda no código e no banco: vitrines de Produtos/Comida com sacola, complementos e pedido pelo WhatsApp com código, simulador de pedidos e vídeos. Não reintroduzir na UI sem pedido.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router), Tailwind 4, Supabase (nuvem), Bunny Storage (imagens), Mux Video (vídeos antigos; o painel não envia mais vídeo), Stripe, Vercel. Repositório em drive FAT32; sem Docker.
- Plano único: **Essencial, R$ 79,90/mês**, com 7 dias de teste grátis sem cartão para toda conta nova. Sem Gratuito nem Pro.
- Teste vencido ou assinatura encerrada: o painel mostra só a tela de assinar (Plano e Conta continuam abertos), a vitrine pública sai do ar e novos agendamentos são recusados. Nada é apagado; ao assinar, tudo volta na hora.
- Aviso no painel nos 3 últimos dias do teste.
- O banco é quem decide o acesso (`effective_plan_id`) e garante que não haja dois agendamentos no mesmo horário.
- Não existem hoje: pagamento do serviço pelo cliente, lembretes automáticos, integração com Google Agenda, várias agendas/profissionais, avaliações, métricas de visualização. Nada disso pode aparecer como se fosse real.
- Instagram, endereço e horários de funcionamento informados no assistente ainda não aparecem na vitrine pública nem são editáveis depois.
- Desempenho: LCP < 2,5 s no 4G e Lighthouse mobile ≥ 90 na vitrine.
- Testes e2e (Playwright, desktop + mobile) dependem de rótulos e textos das telas; mudanças de texto exigem atualizar os testes.

## Brand Commitments

- Nome: **Agenn** ("o Agenn", masculino). Domínio `agenn.com.br`. Os nomes antigos "Agenn Vitrine" e "Vitrimove" não aparecem mais na interface; o arquivo do símbolo continua `public/brand/vitrimove-marca-512.png`.
- Painel claro. Cor da marca: roxo **#673DE6** (ações principais, texto branco); verde só para confirmação; dourado para o plano e a assinatura. Nunito no painel, Figtree na vitrine.
- O visual do painel e das vitrines mergeado em 2026-09-18 (PRs #44 e #45) foi aprovado pelo usuário; mudanças futuras refinam, não recomeçam.
- O painel deve lembrar o Duolingo: simples de usar, passos claros, forte na entrega e no retorno ao usuário.
- Vitrine pública: com a cor e o tema do negócio por cima; a marca do Agenn fica discreta.
- Idioma: português do Brasil, tom direto e caloroso.

## Evidence on Hand

- Referências visuais: `banco de imagens/Referencia de interface interne.png` (painel) e `banco de imagens/Referencia de vitrines.png`.
- Sem depoimentos, clientes ou números de uso reais — não inventar.

## Product Principles

1. O dono sempre sabe qual é o próximo passo e quanto falta.
2. Do link ao horário confirmado pelo caminho mais curto possível.
3. Celular primeiro, sem esquecer o computador.
4. A vitrine é do negócio: a marca dele aparece, a nossa fica discreta.
5. Rápido no 4G vale mais que efeito.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste, alvos de toque ≥ 44 px, foco visível, `prefers-reduced-motion` respeitado. Público com baixa familiaridade digital: rótulos explícitos, sem depender só de ícones.

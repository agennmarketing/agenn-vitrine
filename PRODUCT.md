# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Lojista (dono da vitrine):** pequeno negócio brasileiro — hamburgueria, pizzaria, manicure, clínica, loja de decoração. Não é técnico. Monta e mantém a vitrine quase sempre pelo celular, entre um atendimento e outro; às vezes pelo computador. Precisa sentir que está avançando e terminar rápido.
- **Cliente final:** abre a vitrine pelo link do Instagram/WhatsApp ou pelo QR Code, quase sempre no celular e em 4G. Quer ver foto/vídeo, escolher, montar a sacola e mandar o pedido no WhatsApp sem cadastro.

## Product Purpose

Vitrimove é um SaaS para criar vitrines digitais (catálogos e cardápios) com fotos e vídeos. Não é sistema de pedidos: o cliente monta o que quer e é levado ao WhatsApp do lojista com a mensagem pronta e um código. Sucesso = lojista publica a vitrine sem ajuda e o cliente chega ao WhatsApp com o pedido certo.

## Positioning

Vídeo nos itens (9:16 e 16:9) sem pesar a vitrine, e o pedido chegando pronto no WhatsApp com código — sem pagamento, sem app, sem cadastro do cliente.

## Operating Context

- Três áreas: Acesso (`app.agenn.com.br`: cadastro, login, senha), Painel (`app.agenn.com.br/painel`) e Vitrine pública (`{subdominio}.agenn.com.br`).
- Três tipos de vitrine, escolhidos na criação e imutáveis: `produtos` ("Solicitar orçamento"), `servicos` ("Agendar"), `comida` ("Pedir").
- Painel: vitrines, itens com variações, imagens (4:5) e vídeo, categorias, complementos, WhatsApp(s), mensagens, aparência (logo, cor, banner, tema claro/escuro), configurações, simulador de pedidos, plano (Stripe) e conta (exclusão, QR Code).

## Capabilities and Constraints

- Stack: Next.js 16 (App Router), Tailwind 4, Supabase, Bunny Storage (imagens), Mux Video (vídeos), Stripe, Vercel. Repositório em drive FAT32; sem Docker.
- Planos Gratuito/Pro: logo, cor da marca e banner só no Pro; tema claro/escuro para todos; marca d'água no Gratuito.
- **Toda funcionalidade existente deve continuar funcionando.** A fase de design melhora o visual e a usabilidade; não remove recursos (decisão do usuário, 2026-09-18).
- Não existem hoje: avaliações, "seguir", selo de verificado, métricas de vendas/visualizações. As referências mostram isso, mas nada disso pode aparecer como se fosse real.
- Desempenho: LCP < 2,5 s no 4G e Lighthouse mobile ≥ 90 na vitrine.
- Testes e2e (Playwright, desktop + mobile) dependem de rótulos e textos das telas; mudanças de texto exigem atualizar os testes.

## Brand Commitments

- Nome: **Vitrimove** (antes Agenn Vitrine; troca decidida pelo usuário em 2026-09-18). Logo: lojinha sorridente com linhas de velocidade, roxa (`assets/brand/vitrimove-logo.png`, fonte em `banco de imagens/LOGO VITRIMOVE.svg`; símbolo transparente em `public/brand/vitrimove-marca-512.png`). O domínio continua `agenn.com.br` até a migração.
- Painel claro. Cor da marca: roxo **#673DE6** (ações principais, texto branco); índigo-escuro para placas de destaque; verde só para confirmação; dourado só para Pro (decisão do usuário, 2026-09-18, substituindo o verde).
- O visual do painel e das vitrines mergeado em 2026-09-18 (PRs #44 e #45) foi aprovado pelo usuário; mudanças futuras refinam, não recomeçam.
- O painel deve lembrar o Duolingo: simples de usar, passos claros, forte na entrega e no retorno ao usuário.
- Vitrine pública: um layout por segmento (Comida, Serviços, Produtos), com a cor e o tema do lojista por cima. Referências em `banco de imagens/`.
- Idioma: português do Brasil, tom direto e caloroso.

## Evidence on Hand

- Referências visuais: `banco de imagens/Referencia de interface interne.png` (painel) e `banco de imagens/Referencia de vitrines.png` (Comida, Serviços, Produtos).
- Sem depoimentos, clientes ou números de uso reais — não inventar.

## Product Principles

1. O lojista sempre sabe qual é o próximo passo e quanto falta.
2. O pedido do cliente é o caminho mais curto possível até o WhatsApp.
3. Celular primeiro, sem esquecer o computador.
4. A vitrine é do lojista: a marca dele aparece, a nossa fica discreta.
5. Rápido no 4G vale mais que efeito.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste, alvos de toque ≥ 44 px, foco visível, `prefers-reduced-motion` respeitado. Público com baixa familiaridade digital: rótulos explícitos, sem depender só de ícones.

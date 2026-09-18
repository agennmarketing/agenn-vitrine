---
name: Vitrimove
description: Vitrines digitais com foto e vídeo; painel em trilha no estilo Duolingo, vitrine pública na cor do lojista.
colors:
  canvas: "#f7f6fb"
  surface: "#ffffff"
  subtle: "#efedf7"
  ink: "#17122b"
  ink-muted: "#5e5873"
  line: "#e6e2f0"
  line-strong: "#ccc5df"
  brand: "#673de6"
  brand-hover: "#5a31d6"
  brand-active: "#4b27b8"
  brand-ink: "#ffffff"
  brand-soft: "#efeafd"
  go: "#673de6"
  go-hover: "#7652ee"
  go-lip: "#4a24b8"
  go-ink: "#ffffff"
  go-soft: "#efeafd"
  go-strong: "#5a2fdc"
  go-bright: "#b39cff"
  deep: "#1d1147"
  deep-raised: "#2a1a63"
  deep-ink: "#ffffff"
  deep-muted: "#b9aeeb"
  sun: "#ffc83d"
  sun-lip: "#d9a110"
  sun-soft: "#fff5d6"
  sun-ink: "#4a3500"
  danger: "#c4291c"
  danger-fill: "#e5483a"
  danger-hover: "#93190f"
  danger-lip: "#a8231a"
  danger-soft: "#fdecea"
  success: "#15803d"
  success-soft: "#e4f8ea"
  type-comida: "#ff6b2c"
  type-comida-soft: "#ffeee5"
  type-servicos: "#e83e8c"
  type-servicos-soft: "#fde8f1"
  type-produtos: "#2f7deb"
  type-produtos-soft: "#e6f0fd"
  vitrine-light-canvas: "#f7f7f5"
  vitrine-light-surface: "#ffffff"
  vitrine-light-subtle: "#efefec"
  vitrine-light-ink: "#17181b"
  vitrine-light-ink-muted: "#5c5d66"
  vitrine-light-line: "#e6e6e2"
  vitrine-light-line-strong: "#cdcdc7"
  vitrine-dark-canvas: "#0f0f11"
  vitrine-dark-surface: "#18181b"
  vitrine-dark-subtle: "#232327"
  vitrine-dark-ink: "#f4f4f2"
  vitrine-dark-ink-muted: "#a9a9b2"
  vitrine-dark-line: "#29292e"
  vitrine-dark-line-strong: "#404047"
  vitrine-dark-danger: "#ff7a6b"
typography:
  display:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.375
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  caption:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  vitrine-display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  vitrine-headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  vitrine-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.375
  vitrine-body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
  vitrine-label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "0.625rem"
  button-sm: "0.75rem"
  control: "0.875rem"
  card: "1rem"
  vitrine-banner: "1.75rem"
  sheet: "1.5rem"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-lg: "32px"
  card-pad: "20px"
  card-pad-lg: "24px"
  stack: "24px"
  control-sm: "40px"
  control-md: "48px"
  control-lg: "56px"
  tile: "64px"
  touch-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.go}"
    textColor: "{colors.go-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.go-hover}"
  button-primary-lg:
    backgroundColor: "{colors.go}"
    textColor: "{colors.go-ink}"
    rounded: "{rounded.card}"
    padding: "0 24px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.canvas}"
  button-deep:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-deep-hover:
    backgroundColor: "{colors.deep-raised}"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.sun-ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink}"
  button-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "64px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  input-invalid:
    backgroundColor: "{colors.danger-soft}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  panel-top-bar:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.deep-ink}"
    padding: "12px 16px"
  badge-neutral:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    height: "24px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    height: "24px"
  badge-sun:
    backgroundColor: "{colors.sun-soft}"
    textColor: "{colors.sun-ink}"
    rounded: "{rounded.full}"
    height: "24px"
  editor-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  editor-tab-active:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.deep-ink}"
  side-nav-item-active:
    backgroundColor: "{colors.go-soft}"
    textColor: "{colors.go-strong}"
    rounded: "{rounded.control}"
    height: "48px"
  bottom-nav-item:
    textColor: "{colors.ink-muted}"
    height: "64px"
  bottom-nav-item-active:
    textColor: "{colors.go-strong}"
  choice-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  choice-card-checked:
    backgroundColor: "{colors.go-soft}"
  celebration:
    backgroundColor: "{colors.go-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  vitrine-brand-button:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "56px"
---

# Design System: Vitrimove

## Overview

**Creative North Star: "Trilha da Vitrine"**

Montar a vitrine é uma trilha com fim à vista. O painel (Acesso e Painel, em `app.agenn.com.br`) fala com um lojista não técnico, quase sempre no celular: cada tela diz o próximo passo, um botão roxo gordo o executa e o sistema comemora a entrega. O mundo é claro, com neutros levemente puxados para o roxo da marca (nunca cinza puro), bordas de 2px, tipografia arredondada e pesada (Nunito 800–900) e controles prensáveis com um lábio sólido embaixo que afunda ao toque. A referência declarada é o Duolingo: simples, passos claros, retorno forte. Recusa o painel-admin cinza de tabelas e abas finas.

A vitrine pública (`{subdominio}.agenn.com.br`) é outro mundo, de propósito: é do lojista. Base neutra própria (clara ou escura, escolha do lojista), Figtree neutra, a cor do lojista (`brand`) só em preenchimentos, e um layout por segmento (Comida, Serviços, Produtos). A Vitrimove fica discreta: só o "Feito com Vitrimove" no rodapé do plano Gratuito. Nada do lábio prensável nem da Nunito aqui.

**Acordo com o usuário (2026-09-18).** O visual do painel e das vitrines mergeado nos PRs #44 e #45, mais os acabamentos seguintes (marca Vitrimove, roxo #673DE6, cartão de vitrine enxuto, reordenar por alça, comemorações), foi aprovado. Este é o sistema. Mudanças futuras refinam o que está aqui; não recomeçam, não trocam o mundo e não removem funcionalidade.

**Key Characteristics:**
- Painel claro com neutros lilás; roxo de ação com texto branco; índigo como placa invertida do que é ativo ou principal.
- Volume só nos controles: lábio sólido de 4px que some ao pressionar. Cartões são planos, delimitados por borda de 2px.
- Nunito 800–900 com tracking negativo nos títulos; corpo em 600, nunca fino.
- Progresso visível ("Passo 2 de 4"), comemoração nos marcos, movimento curto com sobressalto e respeito a `prefers-reduced-motion`.
- Vitrine pública com tema derivado da cor do lojista e três layouts por segmento.

## Colors

Uma paleta de papéis rígidos: cada cor quente tem um só trabalho, e o resto é neutro lilás.

### Primary
- **Roxo Vitrimove** (`go` / `brand`, #673DE6): ação principal do painel (botão primário, "Editar", "Salvar", preenchimento da barra de progresso, interruptor ligado, check da comemoração). Texto branco por cima (contraste 6,2:1). Hover clareia (`go-hover`); o lábio é `go-lip`. `go-strong` é a versão de traço e texto: anel de foco, item ativo da navegação, `caret` e `accent-color`. `go-soft` é a placa clara de seleção (opção marcada, item ativo da barra lateral, comemoração, `::selection`). `go-bright` é o "move" do logotipo em fundo escuro.

### Secondary
- **Índigo Profundo** (`deep`, #1D1147): a placa invertida. Cabeçalho do painel (`PanelTopBar`), aba ativa do editor, passo atual do popup do item, avatar do usuário, variante `deep` do botão. Em cima dele: `deep-ink` (branco) e `deep-muted` para texto secundário. O lábio do índigo é preto puro.

### Tertiary
- **Dourado Pro** (`sun`, #FFC83D): só plano Pro e conquistas. Botão "Ver o plano Pro", selo "Plano Pro", aviso de limite de plano (`sun-soft` com borda `sun`), barra de progresso em tom `sun`. Texto sobre o dourado é sempre `sun-ink` (#4A3500), nunca branco.

### Estados
- **Verde Confirmação** (`success` #15803D sobre `success-soft`): só confirmação ("Salvo", "Ativa", mensagem de sucesso). Nunca em botão de ação.
- **Vermelho Perigo** (`danger` para texto e borda, `danger-fill` para o botão destrutivo, `danger-soft` para o fundo de erro): erros de campo, avisos de falha, bloco "zona de perigo" (`ConfigBlock tone="danger"`), excluir.

### Cores de tipo
- **Comida** (#FF6B2C), **Serviços** (#E83E8C), **Produtos** (#2F7DEB): só no quadrado do `TypeIcon` (com lábio de 3px mais escuro) e em marcadores. As versões `-soft` existem para marcadores pequenos. Nunca em áreas grandes, fundos de seção ou botões.

### Neutral
- **Tela Lilás** (`canvas`, #F7F6FB): fundo do documento e do popup do item.
- **Superfície** (`surface`, #FFFFFF): cartões, campos, barra lateral, navegação inferior.
- **Lilás Suave** (`subtle`, #EFEDF7): hover de botões fantasma, campos desativados, selo neutro.
- **Tinta** (`ink`, #17122B) e **Tinta Apagada** (`ink-muted`, #5E5873): texto principal e secundário. O apagado também desenha a seta do `<select>`.
- **Linha** (`line`, #E6E2F0) e **Linha Forte** (`line-strong`, #CCC5DF): bordas de cartão e de controle; `line-strong` é o lábio padrão dos controles neutros.

### Vitrine pública
Neutros próprios, em dois temas (`vitrine-light-*` e `vitrine-dark-*` no frontmatter), tingidos pela cor do lojista (3,5% no claro, 5% no escuro) em `theme.ts`. A cor do lojista entra como `--color-brand` (padrão #673DE6) com `--color-brand-ink` calculado para legibilidade. Onde a marca vira traço ou texto usa-se `--color-accent`, que cai para a cor do texto quando a marca tem contraste < 3:1 com a superfície. Preenchimentos na cor da marca ganham um contorno interno de 1,5px (`--color-brand-edge`) quando quase somem no fundo (contraste < 1,6).

### Named Rules
**The One Job Rule.** Roxo age, índigo marca o ativo, verde confirma, dourado é Pro. Uma cor fora do seu papel é um erro, mesmo que "combine".

**The Type Colors Stay Small Rule.** As cores de Comida, Serviços e Produtos vivem dentro do quadrado do ícone. Se ocupam mais que um ícone, estão erradas.

**The Merchant Owns the Vitrine Rule.** Na vitrine pública a cor é a do lojista e os neutros são da vitrine; nenhum token do painel (roxo fixo, índigo, dourado, Nunito) atravessa para lá.

## Typography

**Fonte do painel:** Nunito (via `next/font`, peso variável, subconjunto latin), com `ui-sans-serif, system-ui` de reserva.
**Fonte da vitrine:** Figtree (via `next/font`, módulo separado para cada área pré-carregar só a sua).

**Character:** Nunito arredondada e pesada dá a pegada de trilha amigável; Figtree neutra deixa a marca do lojista aparecer mais que a nossa.

### Hierarchy (painel)
- **Display** (900, 1.75rem no celular / 2rem a partir de sm, 1.1, −0.025em): título das telas soltas (`PageHeader`) e pergunta de cada passo das trilhas. No cabeçalho índigo o título é 1.25rem/1.5rem 900. Estado vazio usa 1.5rem/900.
- **Headline** (900, 1.375rem / 1.5rem, −0.025em): título de seção do editor (`SectionIntro`).
- **Title** (900, 1.125rem–1.25rem, −0.02em): título de bloco (`ConfigBlock`), nome da vitrine no cartão, título da comemoração.
- **Body** (600, 1rem, 1.5): texto de apoio; parágrafos com `max-width: 65ch` (`max-w-prose`) e `text-wrap: pretty`.
- **Label** (800, 0.9375rem, −0.01em): rótulos de campo, botões (800, "font-extrabold"), itens de navegação. Rótulos de opção grande em 1.0625rem/800.
- **Caption** (600–700, 0.875rem): dicas de campo, descrições de interruptor, erros (700, cor `danger`). Selos em 0.75rem/800.

### Hierarchy (vitrine)
- **Nome da loja** (800, 1.5rem / 1.875rem, −0.025em).
- **Categoria** (800, 1.25rem / 1.5rem, −0.02em).
- **Nome do item** (700 em Comida a 1.0625rem; 700 em Serviços; 600 em Produtos a 0.875–0.9375rem).
- **Descrição** (400, 0.875–0.9375rem, `leading-relaxed`, `ink-muted`, até 65ch).
- **Preço** (700, algarismos tabulares); preço antigo riscado em 0.8125rem/500.

### Named Rules
**The Heavy Headings Rule.** No painel, títulos são 900 com tracking negativo; nada abaixo de 600 em texto de corpo. Leveza tipográfica não faz parte deste mundo.

**The Tabular Numbers Rule.** Todo preço, contagem e código usa o utilitário `numeric` (`tabular-nums`) para os algarismos não dançarem.

## Layout

- **Painel:** coluna única centralizada, `max-width: 64rem` (max-w-5xl), respiro lateral de 16px no celular e 32px a partir de lg. Pilhas verticais com 24px entre blocos e 20–24px dentro dos cartões.
- **Navegação:** no celular, barra inferior fixa de 64px com quatro destinos rotulados (Vitrines, Simulador, Plano, Conta) respeitando `safe-area-inset-bottom`. A partir de lg, barra lateral fixa de 15.5rem com logo + wordmark, navegação, o convite Pro (só no Gratuito) e, no rodapé, avatar, nome, selo do plano e "Sair"; a navegação inferior some. No celular, "Sair" fica no cabeçalho da página Conta.
- **Cabeçalho índigo (`PanelTopBar`):** faixa `deep` (#1D1147) grudada no topo de toda página do painel, 72px (80px em lg), na mesma coluna de 64rem do conteúdo. Sempre diz onde o lojista está: título da seção em branco 900 e uma linha de apoio em `deep-muted`; à esquerda, voltar opcional (círculo de 44px) e ícone opcional; à direita, a ação da seção (ex.: "Nova vitrine"; no editor, "Ver vitrine"). No editor da vitrine, o título é o nome da vitrine e o apoio é o subdomínio. Foco em `go-bright` sobre o índigo.
- **Modo foco:** uma tela que marca `data-focus-mode` (o assistente "Nova vitrine") esconde barra lateral e navegação inferior e não desenha cabeçalho; sobra só a trilha, numa coluna de 36rem com barra de progresso e "Passo N de 4".
- **Popup do item:** novo item e edição abrem por cima da lista (rotas interceptadas em `@modal`; link direto mostra a lista por trás e o popup por cima). Tela cheia no celular; no computador, janela de 42rem com raio `sheet`, borda 2px e `--shadow-float` sobre `deep/60`. Mesma trilha do assistente: fechar, barra de progresso, "Passo N de 4" e quatro passos em pílula (Fotos, Detalhes, Preço, Extras; o atual em índigo, os feitos em `go-soft` com check), uma pergunta por passo e rodapé fixo com Voltar, "Salvar item" (secundário até o último passo, depois primário) e "Continuar". Erro ao salvar leva ao passo do campo. Fechar com alterações pede confirmação.
- **Barra de salvar:** no celular gruda no rodapé logo acima da navegação inferior enquanto o formulário está na tela; no computador (lg) fica parada no fim do formulário.
- **Abas do editor:** fileira de pílulas que rola de lado no celular (com esmaecimento na borda direita e a aba ativa trazida à vista) e quebra linha no computador.
- **Vitrine pública:** container de 1200px com respiro 16/24/32px; banner em sangria no celular, arredondado (1.75rem) no computador; faixa de categorias fixa no topo que acompanha a rolagem; barra flutuante da sacola (64px, pílula, máx. 28rem) no rodapé.
- **Responsivo:** celular primeiro; o cartão de vitrine vai para duas colunas só em xl e com mais de uma vitrine.

## Elevation & Depth

Sistema plano com volume tátil. Superfícies são planas e separadas por borda de 2px e troca de tom (`canvas` → `surface`); a única profundidade estrutural é o lábio sólido dos controles prensáveis. Sombras difusas aparecem só no que flutua de verdade.

### Shadow Vocabulary
- **Lábio prensável** (`box-shadow: 0 4px 0 var(--lip)`): botões (menos o fantasma), ladrilhos e `ChoiceCard`. Ao pressionar, o controle desce 4px e o lábio vai a 0 (120ms, ease-out-quint). Cada variante define seu `--lip`: `go-lip`, `line-strong`, preto no índigo, `sun-lip`, `danger-lip`. Desativado mantém um lábio em `line`.
- **Lábio curto** (`0 3px 0`): quadrado do `TypeIcon` (lábio na versão escura da cor do tipo) e aba ativa do editor (preto).
- **Lábio do botão do interruptor** (`0 2px 0 rgb(29 17 71 / 0.18)`).
- **Controle** (`--shadow-control`: `0 1px 2px rgb(29 17 71 / 0.06)`): reserva discreta.
- **Flutuante** (`--shadow-float`: `0 12px 32px -8px rgb(29 17 71 / 0.3), 0 2px 6px rgb(29 17 71 / 0.08)`): a linha levantada durante o arrasto e a barra da sacola na vitrine.

### Named Rules
**The Lip Not Shadow Rule.** Controles ganham volume pelo lábio sólido, nunca por sombra difusa. Cartões nunca têm sombra: só borda de 2px.

**The Only Floaters Float Rule.** Sombra difusa só em algo que está de fato acima da página (item sendo arrastado, barra da sacola, botões sobre o banner).

## Shapes

Cantos generosos e amigáveis, sempre arredondados, nunca pontudos.
- **Ícone pequeno** (0.625rem), **botão pequeno** (0.75rem), **controle** (`--radius-control`, 0.875rem): botões médios, campos, ladrilhos, itens da barra lateral.
- **Cartão** (`--radius-card`, 1rem): cartões, blocos, `ChoiceCard`, botão grande, avisos. Na vitrine, cartões e fotos também usam 1rem (fotos da Comida 1rem via rounded-2xl).
- **Folha** (`--radius-sheet`, 1.5rem): bottom sheets da vitrine; banner no computador em 1.75rem.
- **Pílula** (9999px): selos, pílulas de uso do plano, abas do editor, interruptor, barra de progresso, e na vitrine: botão da marca, busca, categorias, "+", barra da sacola.
- **Bordas:** 2px em todo controle e cartão do painel; a vitrine usa 2px em campos e 1px (ring) em cartões e pílulas inativas.

## Components

### Buttons
Táteis e confiantes: gordos, em 800, com lábio que afunda.
- **Tamanhos:** `sm` 40px (raio 0.75rem), `md` 48px (raio control), `lg` 56px (raio card, 1.0625rem), `tile` 64px no celular com ícone sobre o rótulo em 0.8125rem, virando linha de 48px a partir de sm.
- **Variantes:** `primary` (roxo, a ação da tela; uma por contexto), `secondary` (branco com borda 2px `line-strong`, ações de apoio e ladrilhos), `deep` (índigo), `sun` (só Pro), `danger` (destrutivo), `ghost` (sem lábio, hover em `subtle`; ações de baixo peso como "Sair").
- **Estados:** hover troca o tom; `:active` afunda 4px; foco com contorno 3px `go-strong` a 2px; desativado vai para `subtle` / `ink-muted` com cursor bloqueado. `SubmitButton` desativa e mostra um spinner enquanto envia.

### Chips / Badges
- **Selo** (`Badge`): pílula de 24px, 0.75rem/800, tons `neutral`, `go`, `success`, `sun`, `danger`, `deep`. O selo do plano no cabeçalho é neutro no Gratuito e `sun` no Pro.
- **Pílulas de informação** (cartão de vitrine: "2 vídeos", "Criada em 18 de set. de 2026"): 32px, fundo `canvas`, anel 2px `line`, ícone de 14px e texto 0.8125rem/700 `ink-muted`. O uso do plano saiu da tela inicial; fica na página Plano (e "N de M vitrines" no apoio do cabeçalho).

### Cards / Containers
- **Card:** raio 1rem, `surface`, borda 2px `line`, sem sombra, padding 20px (24px a partir de sm).
- **ConfigBlock:** o Card com título (1.125rem/900), apoio e selo à direita; tom `danger` troca a borda para `danger/45`.
- **Aviso:** mesmo formato em tom suave (`sun-soft` para limite de plano, `danger-soft` para falha).
- **Estado vazio:** borda 2px tracejada `line-strong`, os três `TypeIcon` inclinados, título 900 e um botão primário grande.

### Inputs / Fields
- **Estilo:** 48px, raio control, borda 2px `line-strong`, `surface`, texto 1rem/600, placeholder 500 em `ink-muted/80`. `Textarea` mínimo 7rem; `Select` com a seta desenhada (`select-chevron`, traço 2.5 no tom `ink-muted`).
- **Foco:** a borda passa a `go-strong` (sem contorno extra).
- **Erro:** borda `danger`, fundo `danger-soft/40`, `aria-invalid` e `aria-describedby` ligados à mensagem do `Field` (ícone de alerta + texto 700 em `danger`, entrando com `rise`).
- **Desativado / só leitura:** fundo `subtle` ou `canvas`, texto `ink-muted`.
- **Field:** rótulo 0.9375rem/800 acima, sempre visível; dica ou erro abaixo.
- **FormMessage:** faixa com ícone, borda 2px e fundo suave, `role="alert"` para erro e `role="status"` para sucesso (o check faz `pop`).

### Navigation
- **Barra lateral (lg):** itens de 48px, 0.9375rem/800, ícone 24px. Ativo: placa `go-soft` com borda 2px `go/70`, texto `go-strong`, traço do ícone 2.75.
- **Barra inferior (celular):** quatro colunas de 64px, rótulo 0.75rem/800 sob o ícone. Ativo: texto `go-strong` e uma pílula `go-soft` de 28×48px atrás do ícone.
- **Abas do editor:** pílulas de 44px com ícone e rótulo, borda 2px `line`. Ativa: placa índigo com lábio preto de 3px.
- **PageHeader:** "voltar" opcional (chevron + rótulo 800), título Display, apoio e ações à direita.

### Cartão de vitrine (assinatura)
Cartão branco com borda 2px. Em cima: `TypeIcon` de 64px (`xl`), nome 1.25–1.375rem/900 (link para o editor) com o selo de status ao lado ("Ativa" em `success` com ponto), o endereço em `go-strong` sublinhado com ícone de link externo (abre a vitrine) e as pílulas de informação; no canto, o menu ⋮ com atalhos para cada seção do editor e "Ver vitrine". Embaixo, três botões lado a lado: Copiar link e QR Code (secundários) e **Editar** (primário, com seta). Os cartões entram com `rise` escalonado em 60ms. Não mostrar métricas que o produto não mede (visualizações).

### Convite Pro
`ProUpsell`, só no plano Gratuito: placa `go-soft` com borda `go/25`, coroa `go-strong`, "Vá mais longe com o Plano Pro" (900) e apoio, e "Fazer upgrade →" como botão primário pequeno. No rodapé da barra lateral (lg) e no fim de Minhas vitrines no celular. Segue o anexo aprovado pelo usuário (roxo, não dourado).

### ChoiceCard
Opção grande prensável (radio ou checkbox) no molde das respostas do Duolingo: borda 2px `line-strong` com lábio, 1.0625rem/800. Marcada: borda e lábio `go`, fundo `go-soft`, círculo de check que faz `pop`. O input real cobre o cartão, transparente, e recebe toque, rótulo e teclado. Layout `row` (mínimo 64px) ou `stack` (prévia em cima, check no canto).

### Interruptor
`Switch` (botão `role="switch"`) e `ConfigToggle` (checkbox nativo com `role="switch"`, vai no FormData): trilho 56×32px, desligado em `line`, ligado em `go` com borda `go-lip`; bolinha branca desliza com sobressalto (300ms ease-out-back).

### ProgressBar
Trilho de 16px em `line`, preenchimento `go` (ou `sun`) com reflexo branco a 35% no topo; a largura anima 700ms com sobressalto. Sempre acompanhada de texto ("Passo 2 de 4").

### Comemoração
`Celebration`: faixa `go-soft` com borda `go/40`, check branco num círculo roxo de 48px com lábio `go-lip` que faz `pop`, e um anel que se expande uma vez e some. Usada só nos marcos: vitrine criada e primeiro item salvo. `role="status"`, exceto quando outro aviso já fala.

### Reordenar por alça
`SortableList` + `DragHandle` para categorias, itens, grupos, opções e variações. O arrasto começa só pela alça (ícone grip, área de toque de 44px mesmo quando o desenho é menor): mouse, toque com pequeno atraso, ou teclado (Espaço/Enter pega, setas movem, Espaço solta, Esc cancela) com anúncios em português. A linha levantada flutua com borda `go` e `--shadow-float`; o destino fica marcado com borda tracejada `go` sobre `go-soft`.

### Marca
`LogoMark`: a lojinha sorridente roxa com linhas de velocidade (`/brand/vitrimove-marca-512.png`, fundo transparente), 44px no cabeçalho e na barra lateral. `Wordmark`: "Vitri" em `deep` e "move" em `go`, 900, −0.03em; em fundo escuro, branco e `go-bright`.

### Vitrine pública
- **Topo:** banner (imagem ou vídeo) 16:10 no celular, 5:2 em sm, 16:5 em lg; sem banner, uma faixa `brand-soft`. Avatar redondo de 80–112px com anel `canvas` de 4px sobreposto; sem logo, iniciais na cor da marca. Botão da sacola redondo translúcido no canto do banner, com contador que faz `bump`.
- **Busca** em pílula de 48px; **categorias** em pílulas de 40px, a ativa na cor da marca.
- **Três layouts:** *Comida* é lista com texto à esquerda e foto quadrada de 112–128px à direita com o "+" sobreposto (duas colunas em lg). *Serviços* tem cabeçalho de perfil (nome ao lado do avatar, subindo sobre o banner), botão de ação da marca, e cartões em 2 colunas (3 em lg) com imagem 4:3, "a partir de", duração e seta. *Produtos* é grade limpa de 2/3/4 colunas com imagem 4:5, nome, preço e "+" pequeno.
- **Botão da marca:** pílula de 56px (48px no cabeçalho), 700, `brand` / `brand-ink`, `active:scale(0.98)`.
- **"+" (PlusBubble)** e **StepButton:** círculos na cor da marca; o "+" cresce 10% no hover e encolhe ao tocar.
- **Opções no item:** cartões de 56px, raio 1rem, borda 2px; marcado em `accent` sobre `brand-soft`; marca de radio/checkbox em `accent`.
- **Esgotado:** pílula `ink` sobre a foto, foto em escala de cinza, sem "+".
- **Barra da sacola:** pílula flutuante de 64px na cor da marca com contador, "Ver sacola", quantidade e total.

## Do's and Don'ts

### Do:
- **Do** usar uma única ação primária roxa por contexto, grande e com rótulo explícito ("Editar", "Salvar", "Criar vitrine").
- **Do** dar lábio (`pressable`, 4px) a todo botão e opção selecionável do painel, com o `--lip` da variante.
- **Do** separar superfícies com borda de 2px e troca de tom, nunca com sombra.
- **Do** mostrar onde o lojista está e quanto falta: "Passo N de M" com `ProgressBar`, abas em pílula com a ativa em índigo.
- **Do** usar `SaveBar` em todo formulário de configuração, para "Salvar" ficar sempre ao alcance do polegar no celular.
- **Do** comemorar só marcos reais (vitrine criada, primeiro item) com `Celebration`.
- **Do** manter todo alvo de toque com pelo menos 44px (controles de 44–64px; a alça de arrasto expande a área para 44px).
- **Do** manter o foco visível: contorno de 3px `go-strong` com afastamento de 2px (na vitrine, em `accent`).
- **Do** respeitar `prefers-reduced-motion`: animações e transições caem para 0,01ms; o anel da comemoração e a rolagem suave das categorias só rodam com movimento permitido.
- **Do** animar com `ease-out-quint` para deslizes e `ease-out-back` para sobressaltos (pop, bump, interruptor, barra de progresso), em degraus curtos (120–420ms).
- **Do** fazer entradas partirem do estado visível (`rise` só desliza 6px, sem começar transparente).
- **Do** usar `numeric` em todo preço, contagem e código.
- **Do** na vitrine, usar a cor do lojista só como preenchimento e `--color-accent` para traço e texto.

### Don't:
- **Don't** recomeçar o visual: ele foi aprovado em 2026-09-18. Refinar, sim; trocar o mundo, a paleta ou a fonte, não.
- **Don't** usar verde em ação: verde é só confirmação.
- **Don't** usar dourado fora de Pro e conquistas.
- **Don't** pintar áreas grandes com as cores de tipo (Comida, Serviços, Produtos); elas ficam no quadrado do ícone.
- **Don't** usar cinza puro nos neutros do painel; eles são puxados para o lilás.
- **Don't** pôr sombra difusa em cartões nem no lugar do lábio.
- **Don't** usar texto em caixa alta espaçada como sobretítulo ("eyebrow"/"kicker") acima de títulos; caixa alta fica só para códigos de item e pedido.
- **Don't** depender só de ícone: todo ícone de navegação e ladrilho tem rótulo visível (no celular, "Sair" é a única exceção, com nome acessível mantido).
- **Don't** levar Nunito, roxo fixo, índigo, dourado ou lábio prensável para a vitrine pública.
- **Don't** inventar na vitrine avaliações, "seguir", selo de verificado, tempo de entrega ou métricas que o produto não tem.
- **Don't** usar texto de corpo abaixo de 600 no painel nem títulos abaixo de 900.
- **Don't** trocar os textos visíveis sem atualizar os testes e2e que dependem deles.

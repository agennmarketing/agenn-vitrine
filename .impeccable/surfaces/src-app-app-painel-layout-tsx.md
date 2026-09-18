---
version: 1
slug: "src-app-app-painel-layout-tsx"
primary_target: "src/app/app/(painel)/layout.tsx"
related_targets: ["src/app/app/(auth)"]
---

# Painel e Acesso (app.agenn.com.br)

Modo: Operate. Público: lojista não técnico, quase sempre no celular. Tarefa: criar a vitrine, cadastrar itens com foto/vídeo, configurar WhatsApp e sacola, divulgar. Restrição: nenhuma funcionalidade existente pode sumir; testes e2e dependem de rótulos.

## Direction contract

THESIS: Montar a vitrine é uma trilha com fim à vista — cada tela diz o próximo passo, um botão verde gordo o executa e o sistema comemora a entrega. Recusa o painel-admin cinza de tabelas e abas finas.

OWN-WORLD: Claro. Fundo branco com leve tom verde; bordas de 2px; botões e opções selecionáveis prensáveis com lábio sólido embaixo (0 4px 0) que afunda ao tocar; ação em verde vivo com texto verde-escuro da logo; o verde-escuro #0B2A1C é a placa invertida do que é ativo/principal; dourado só para Pro e conquistas; ícones de tipo em quadrados coloridos (Comida laranja, Serviços rosa, Produtos azul). Tipografia arredondada e pesada (Nunito 800–900 nos títulos).

STORY: O lojista entende em 1 segundo onde está e quanto falta ("3 de 4"), acredita que termina hoje, e toca no próximo passo.

FIRST VIEWPORT: Celular, /painel: saudação curta; cartão da vitrine com placa verde-escura (nome, endereço, Ativa), barra de progresso da trilha e o próximo passo como botão prensável; abaixo, atalhos Copiar link / QR Code / Ver vitrine. Navegação inferior fixa com 4 ícones rotulados (Vitrines, Simulador, Plano, Conta). Desktop: a mesma coluna central com barra lateral esquerda de navegação.

FORM: Trilha da Vitrine (candidato 1 da lista, escolha do usuário sobre o sorteio), seed 2a1432d9. Interação assinatura: botão prensável + barra de progresso que enche com leve sobressalto; comemoração (pop do check) ao criar a vitrine e ao salvar o primeiro item. Movimento: ease-out exponencial, degrau curto; respeita prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

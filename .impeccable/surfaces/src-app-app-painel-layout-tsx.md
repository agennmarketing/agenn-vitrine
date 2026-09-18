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

OWN-WORLD: Claro. Fundo branco com leve tom lilás; bordas de 2px; botões e opções selecionáveis prensáveis com lábio sólido embaixo (0 4px 0) que afunda ao tocar; ação no roxo da Vitrimove #673DE6 com texto branco; índigo-escuro é a placa invertida do que é ativo/principal; verde só para confirmação; dourado só para Pro e conquistas; ícones de tipo em quadrados coloridos (Comida laranja, Serviços rosa, Produtos azul). Tipografia arredondada e pesada (Nunito 800–900 nos títulos). Marca: Vitrimove (lojinha sorridente roxa). Atualizado em 2026-09-18: troca do verde pelo roxo e do nome, a pedido do usuário.

STORY: O lojista entende em 1 segundo onde está e quanto falta ("3 de 4"), acredita que termina hoje, e toca no próximo passo.

FIRST VIEWPORT: Celular, /painel: título "Minhas vitrines" e o uso do plano em pílulas; cada vitrine é um cartão com placa índigo (ícone do tipo, nome, endereço, status) e, abaixo, "Editar" como botão roxo grande e três ladrilhos (Copiar link, QR Code, Ver vitrine). A trilha de progresso saiu do cartão a pedido do usuário. Navegação inferior fixa com 4 ícones rotulados (Vitrines, Simulador, Plano, Conta). Desktop: a mesma coluna com barra lateral esquerda.

FORM: Trilha da Vitrine (candidato 1 da lista, escolha do usuário sobre o sorteio), seed 2a1432d9. Interação assinatura: botão prensável + barra de progresso que enche com leve sobressalto; comemoração (pop do check) ao criar a vitrine e ao salvar o primeiro item. Movimento: ease-out exponencial, degrau curto; respeita prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

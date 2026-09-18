---
version: 1
slug: "src-app-v-subdomain-catalog-tsx"
primary_target: "src/app/v/[subdomain]/catalog.tsx"
related_targets: []
---

# Vitrine pública ({subdominio}.agenn.com.br)

Modo: Persuade/Experience. Público: cliente final no celular, em 4G, vindo do Instagram/WhatsApp/QR. Tarefa: ver, escolher, montar a sacola e mandar ao WhatsApp. A vitrine é do lojista: marca dele à frente, Agenn discreta. LCP < 2,5 s no 4G, Lighthouse mobile ≥ 90.

## Direction contract

THESIS: Um layout por segmento, com a foto do lojista liderando e o caminho até o WhatsApp sempre a um toque. Recusa o catálogo genérico de grade única igual para pizzaria e manicure.

OWN-WORLD: Base neutra que recebe a cor do lojista (--color-brand) e o tema claro/escuro dele; cantos 16px; botão redondo "+" na cor da marca; sem invenções (sem avaliações, seguir, verificado, tempo de entrega). Comida: lista com foto à esquerda e "+" rápido, fundo escuro combina. Serviços: cabeçalho de perfil com avatar e cartões 2 colunas "a partir de". Produtos: grade limpa 2–4 colunas com imagem 4:5.

STORY: O cliente reconhece a loja em 1 segundo (banner/logo/nome), acha o item pela categoria ou busca e manda o pedido com código em poucos toques.

FIRST VIEWPORT: Banner (imagem ou vídeo) em sangria no topo com o logo sobreposto; nome e descrição; busca; faixa de categorias fixa; primeiros itens já visíveis acima da dobra no celular. Barra flutuante da sacola na cor da marca quando há itens.

FORM: Referência do usuário (banco de imagens/Referencia de vitrines.png) por segmento, seed 2a1432d9 (painel). Interação assinatura: "+" que salta ao adicionar e contador da sacola que pulsa.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

# Fase 6 — Conferência em produção

Sem variáveis novas e sem passo de infraestrutura. O que muda em produção: páginas legais,
excluir conta, QR Code, `robots.txt`/`sitemap.xml` e as checagens de disponibilidade.

## Antes de tudo: preencher os dados da empresa

`src/lib/legal/company.ts` está com "A PREENCHER" na razão social, no CNPJ e no endereço.
Enquanto estiver assim, os textos legais **não estão prontos** para o lançamento. Preencha,
mude `LEGAL_VERSION` para a data da publicação e mande revisar por um profissional — o texto
entregue aqui é um rascunho, não um parecer jurídico.

1. **Páginas legais:** `app.agenn.com.br/termos` e `app.agenn.com.br/privacidade` abrem, mostram
   "Última atualização" e não têm "A PREENCHER". O apex `agenn.com.br` é o site institucional
   já mantido pelo usuário, atrás do Cloudflare — não é servido pela nossa aplicação, então as
   páginas ficam no host do painel, que é o nosso. As mesmas páginas continuam publicadas em
   `agenn.com.br/termos` e `/privacidade` para quando o domínio raiz passar a ser servido por
   nós. Os links aparecem no rodapé da página inicial, abaixo do botão do cadastro (apontando
   para o host do painel) e na tela Conta.
2. **QR Code:** no painel, "QR Code" abre o código da vitrine, o endereço mostrado é o da
   vitrine e "Baixar PNG" salva o arquivo. Ler o QR com o celular precisa abrir a vitrine.
3. **Excluir conta (use uma conta de teste):** a confirmação exige o e-mail certo; depois da
   exclusão, a vitrine sai do ar, o login não funciona mais e, no Stripe, a assinatura aparece
   como cancelada e o Customer continua lá (histórico fiscal).
4. **robots.txt:** `app.agenn.com.br/robots.txt` traz `Disallow: /` e responde sem exigir login;
   `agenn.com.br/robots.txt` traz `Allow: /` e o link do sitemap;
   `{vitrine}.agenn.com.br/robots.txt` traz o sitemap da vitrine.
5. **sitemap.xml:** `{vitrine}.agenn.com.br/sitemap.xml` lista a vitrine e um `?item=CÓDIGO`
   por item. Numa vitrine congelada, responde 404. Essa checagem **precisa ser feita no domínio
   de produção** (não em `next start` local nem no CI): como `sitemap.xml` é nome reservado pelo
   Next, um build antigo podia gerar uma página estática com parâmetro placeholder em vez da
   rota dinâmica — `next start` ainda respondia 200 nesse cenário quebrado, mas a Vercel servia
   404 pelo CDN. Confirme sempre com `curl` no domínio real.
6. **Disponibilidade:** no assistente e nas configurações, digitar um endereço já usado mostra
   "Este endereço já está em uso"; digitar rápido e sair da página não deve gerar
   "Failed to find Server Action" nos logs da Vercel. As checagens de disponibilidade agora são
   as rotas `GET /api/disponibilidade/subdominio` e `/api/disponibilidade/codigo`, que
   respondem 401 sem sessão.
7. **Prévia da Vercel:** abrir a URL `*.vercel.app` de um PR leva ao painel (antes dava
   "host inválido").

## Pendências registradas

- Desempenho e Lighthouse ≥ 90 (spec 7.6 e 11) ficaram para a fase de design.
- Migração de domínio (spec 2.2) continua pendente e tem roteiro próprio na spec; os QR Codes
  já gerados seguem funcionando pelo redirecionamento 301.
- Consentimento de termos dentro do Checkout do Stripe (`consent_collection`) não está ligado;
  o aceite acontece no cadastro.
- Bunny Stream saiu: o vídeo agora é o Mux Video (ticket do fornecedor encerrado).

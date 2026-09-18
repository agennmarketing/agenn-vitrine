# Handoff — fase de design

Resumo curto para começar a fase de design numa sessão nova. Detalhe completo está nos planos em
`docs/superpowers/plans/` e na spec `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`.

## Onde o produto está

Fases 1 a 6 concluídas e em produção (PRs até #43, 2026-09-18). O sistema faz: cadastro e login com
sessão única, vitrines de Produtos/Serviços/Comida por subdomínio, itens com variações, imagens e
vídeo, complementos e sacola, pedido pelo WhatsApp com código, simulador, assinatura Pro pelo Stripe
com congelamento ao voltar ao gratuito, exclusão de conta, QR Code, termos e privacidade,
robots/sitemap. Testes: 244 unitários (Vitest), 142 pgTAP, ~120 e2e (Playwright, desktop + mobile).

O que **não** existe ainda: refino visual. Todas as telas usam a fundação de estilo da Fase 1 sem
nenhum passe de design — foi decisão do usuário ("implementar rápido, deixar o design bonito para
uma fase dedicada depois").

## O que a fase de design deve cobrir

Itens adiados de propósito ao longo das fases:

- **Visual do painel e das vitrines** — é o pedido central do usuário: "design beeeem bonito".
- **Desempenho (spec 7.6 e 11):** LCP < 2,5 s no 4G, Lighthouse mobile ≥ 90, medido em CI ou à mão.
  Foi tirado da Fase 6 e colocado aqui de propósito, porque imagens, fontes e animações mexem nos
  mesmos números.
- **Arrastar para reordenar:** categorias, itens, grupos de complementos, opções e vínculos do item.
  Hoje são botões Subir/Descer e ordem de criação.
- **Prévia ao vivo no editor** (hoje é um link "Ver vitrine") e **barra fixa de "alterações não
  salvas"** (hoje é o aviso do navegador ao sair).
- **Dívidas cosméticas pequenas:** apóstrofos retos no texto legal (`src/lib/legal/`), `key={paragraph}`
  no `LegalDocument`, o trio debounce+AbortController repetido em três formulários (cabe um
  `useAvailability`), vitrine congelada devolvendo robots 200 e sitemap 404.

## Como se trabalha neste repositório

- Uma branch e um PR por bloco (`fase-design/bloco-N-...`), merge só com CI verde.
- Localmente: `npm run lint`, `npm run typecheck`, `npm test`, e `npm run build` quando criar rota.
- pgTAP e Playwright completos rodam no CI. `gh` está em `C:\Program Files\GitHub CLI`.
- Dá para rodar Playwright localmente contra o Supabase de desenvolvimento na nuvem — muito mais
  rápido que esperar o CI para depurar:

  ```
  CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes \
  MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 \
  CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake \
  npx playwright test e2e/<arquivo> --project=desktop
  ```

## Armadilhas de ambiente (já custaram tempo)

- O repositório vive num drive **FAT32 removível**; sem Docker, sem worktree (cada um exigiria seu
  próprio `node_modules`). Processos `next dev` órfãos travam a pasta — encerre antes de trocar de branch.
- **O apex `agenn.com.br` não é servido pela Vercel** — é o site institucional do usuário, no
  Cloudflare. Só `app.agenn.com.br` e `*.agenn.com.br` são da aplicação. Qualquer página nova em
  `src/app/site/` fica inalcançável em produção.
- **Nomes reservados do Next:** `sitemap.xml` como segmento dinâmico vira página pré-gerada e a Vercel
  responde 404, embora `next start` (local e CI) responda 200. Confira rota nova **no domínio de
  produção** e veja na listagem do `npm run build` se ela é ƒ (dinâmica) ou ● (pré-gerada).
- `redirect()` de Server Action para URL do mesmo domínio que seja rota de API quebra o roteador;
  devolva a URL e navegue com `window.location.assign`.
- `formatBRL` usa espaço não separável (`\u00A0`): nos testes, casar por regex.
- O stub do Sentry (`src/lib/monitoring/sentry-noop.ts`) precisa exportar cada membro `Sentry.*` novo,
  senão o build quebra.

## Pendências que não são de design

- Preencher `src/lib/legal/company.ts` (razão social, CNPJ, endereço) e mandar os textos legais para
  revisão profissional. Mudou o texto, mude `LEGAL_VERSION`.
- Rodar `docs/setup/fase-5-conferencia.md` e `docs/setup/fase-6-conferencia.md`.
- Virar o Stripe do modo de teste para o ao vivo: `docs/setup/fase-5-infra.md` §7 (inclui limpar as
  assinaturas de teste de `subscriptions`).
- Bunny Stream travado em "Processing" — chamado aberto com o fornecedor.
- Migração de domínio para `agennvitrine.com.br` (spec 2.2) — operação própria, com roteiro na spec.

# Fase 2 — Infraestrutura

Complementa `docs/setup/fase-1-infra.md`. Tudo aqui é configuração de painel (Bunny, Vercel, GitHub); o código não tem nenhum destes valores fixos.

## 1. Bunny Storage e Pull Zone (imagens)

1. **Storage → Add Storage Zone**
   - Nome: `agenn-vitrine-img`
   - S3 Compatibility: desligado (o app usa a API HTTP do Bunny)
   - Storage tier: **Standard**
   - Região principal: **São Paulo (BR)**, sem replicação (regiões não podem ser removidas depois)
   - Em **FTP & API Access**, anotar a **Password** e o **Hostname** (esperado: `br.storage.bunnycdn.com`)
2. **Pull Zone** ligada à Storage Zone, rede **Volume**
   - **Caching**: "Cache expiration time" = 1 ano; "Browser cache expiration" = 1 ano. Os arquivos são imutáveis: trocar uma imagem gera outro nome.
   - Anotar o host público, ex.: `https://agenn-vitrine-img.b-cdn.net`
3. **Account → Billing**: alerta de gasto (spec 6.4).

Caminho dos arquivos: `{owner_id}/{vitrine_id}/{media_id}-{largura}.{webp|jpg}`.

## 2. Variáveis na Vercel (projeto `agenn-vitrine-v1`, ambiente Production)

| Variável | Valor | Desde |
|---|---|---|
| `SUPABASE_SECRET_KEY` | chave `sb_secret_…` do projeto (Sensitive) | Bloco 4 |
| `MEDIA_STORAGE_DRIVER` | `bunny` | Bloco 5 |
| `BUNNY_STORAGE_ZONE` | `agenn-vitrine-img` | Bloco 5 |
| `BUNNY_STORAGE_PASSWORD` | senha da Storage Zone (Sensitive) | Bloco 5 |
| `BUNNY_STORAGE_HOST` | hostname da Storage Zone (`br.storage.bunnycdn.com`) | Bloco 5 |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | host da Pull Zone, sem barra final | Bloco 5 |
| `RATE_LIMIT_SALT` | valor aleatório longo (Sensitive), gerar com `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"` | Bloco 7 |
| `ORDER_RATE_LIMIT_PER_HOUR` | opcional; padrão 20 | Bloco 7 |

`NEXT_PUBLIC_*` entra no build: depois de criar ou mudar, fazer **redeploy**.

## 3. GitHub

- Segredo `SUPABASE_DB_URL` (URL do pooler de sessão, porta 5432) usado pelo job `migrate`.
- Workflow `CI`:
  - `checks`: lint, typecheck, Vitest
  - `db`: Supabase local no runner, pgTAP, geração dos tipos (artefato `database-types`)
  - `e2e`: build de produção + Playwright (desktop e mobile) com driver de mídia `fake`
  - `migrate`: só na `master`, aplica migrações no Supabase dev

## 4. Riscos aceitos

- Imagens enviadas e não salvas em um item ficam órfãs até a limpeza diária (Fase 3).
- Falha ao apagar um arquivo no Bunny vai para o Sentry e não bloqueia a exclusão; a limpeza diária recolhe o resto.
- `MEDIA_STORAGE_DRIVER=fake` é recusado quando `VERCEL_ENV=production`.

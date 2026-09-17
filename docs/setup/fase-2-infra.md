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

## 5. Conferência em produção

No celular e no computador:

1. Criar conta nova, criar vitrine de Serviços, cadastrar dois itens com foto (um com variações e mensagem personalizada, outro com WhatsApp secundário).
2. Abrir `https://{subdominio}.agenn.com.br`: listagem, busca por código, barra de categorias, tela do item e envio ao WhatsApp (número, texto e `Pedido #`).
3. Abrir o link `?item=` em outro aparelho.
4. Simulador: consultar o código, alterar um preço no painel, consultar de novo e ver o aviso de preço alterado; copiar o resumo.
5. Trocar o subdomínio em Configurações: o antigo responde "Vitrine não encontrada" e o novo abre.
6. Excluir a vitrine de teste e conferir no Bunny que os arquivos dela sumiram.
7. Conferir no Sentry (quando configurado) que não houve erros novos.

## 6. Pendências registradas

- **Fase de design:** arrastar para reordenar (hoje "Subir"/"Descer"), prévia ao vivo no editor (hoje "Ver vitrine"), barra "Alterações não salvas" (hoje aviso do navegador ao sair), acabamento visual do painel e da vitrine.
- **Endurecimento:** as verificações de endereço e de código do item são server actions chamadas com atraso; se a página muda no meio, o servidor registra "Failed to find Server Action" (inofensivo, mas gera ruído no Sentry). Trocar por rotas GET de consulta.
- **Fase 3:** limpeza diária de mídias órfãs (inclusive imagens enviadas e não salvas) e de `order_snapshots`/`rate_limits` antigos.
- **Fase 6:** `robots.txt`/`sitemap.xml` por vitrine (o matcher do proxy ignora `.txt`/`.xml`), QR Code, prévias `*.vercel.app` sem roteamento.
- **Desempenho:** meta de Lighthouse ≥ 90 ainda não medida no CI.
- **Lições de configuração:** variáveis da Vercel precisam estar marcadas para **Production** (a `SUPABASE_SECRET_KEY` ficou só em Preview e quebrou o envio de imagens). Na tela nova da Vercel, "Sensitive" se chama **Secret**. Se um merge não gerar deploy, usar **Redeploy** no último deploy de Production.

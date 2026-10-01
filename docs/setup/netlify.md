# Publicação na Netlify (plano Free)

O app roda na Netlify sem adaptação de código: o adaptador oficial de Next.js da
Netlify é detectado sozinho. O que mudou em relação à Vercel:

- a tarefa diária virou uma *scheduled function* (`netlify/functions/cron-diaria.ts`),
  que chama `/api/cron/diaria` às 07:00 UTC (04:00 em Brasília), como o `vercel.json`;
- `APP_ENV=production` faz o papel do `VERCEL_ENV` (HSTS e bloqueio dos drivers falsos);
- endereços `*.netlify.app` abrem direto o painel, como as prévias da Vercel.

**Limite do plano Free:** a Netlify não aceita subdomínio curinga (`*.vitrimove.site`)
fora do plano Pro. Cada vitrine é cadastrada à mão (seção 5). Reavaliar ao chegar
em ~5 assinantes.

## 1. Criar o site

1. Netlify → *Add new project* → *Import an existing project* → GitHub →
   `agennmarketing/agenn-vitrine`, branch `master`.
2. Build command: `npm run build`. Publish directory: `.next`. (A Netlify já
   preenche os dois ao detectar o Next; confira só.)
3. Antes do primeiro deploy, cadastre as variáveis da seção 2.

## 2. Variáveis de ambiente

*Site configuration → Environment variables.* Marque como **secretas** (opção
"Contains secret values") as da segunda tabela.

| Variável | Valor |
|---|---|
| `APP_ENV` | `production` — **só no contexto Production** |
| `NEXT_PUBLIC_APP_ENV` | `production` — só em Production (ambiente no Sentry do navegador; opcional) |
| `NODE_VERSION` | `24` (mesma versão do CI) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `vitrimove.site` |
| `LEGACY_DOMAINS` | vazio |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável do Supabase |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | vazio, ou a chave se o Turnstile estiver ligado |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | igual à Vercel (`false` hoje) |
| `MEDIA_STORAGE_DRIVER` | `bunny` |
| `BUNNY_STORAGE_ZONE` | nome da zona |
| `BUNNY_STORAGE_HOST` | `br.storage.bunnycdn.com` |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | URL da Pull Zone do Bunny |
| `VIDEO_DRIVER` | `mux` |
| `MUX_TOKEN_ID` | id do token do Mux |
| `NEXT_PUBLIC_VIDEO_CDN_BASE_URL` | `https://stream.mux.com` |
| `EMAIL_DRIVER` | igual à Vercel (`off` ou `resend`) |
| `EMAIL_FROM` | `Vitrimove <nao-responda@vitrimove.site>` (domínio verificado no Resend) |
| `BILLING_DRIVER` | `stripe` |
| `STRIPE_PRICE_MONTH` | `price_...` do Plano Essencial |
| `ORDER_RATE_LIMIT_PER_HOUR` | `20` (opcional) |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | só se o Sentry estiver ligado |

Secretas:

| Variável | Valor |
|---|---|
| `SUPABASE_SECRET_KEY` | chave secreta do Supabase |
| `BUNNY_STORAGE_PASSWORD` | senha da zona do Bunny |
| `MUX_TOKEN_SECRET` | segredo do token do Mux |
| `MUX_WEBHOOK_SECRET` | segredo do webhook do Mux |
| `STRIPE_SECRET_KEY` | `sk_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` do endpoint (seção 4) |
| `RESEND_API_KEY` | se `EMAIL_DRIVER=resend` |
| `RATE_LIMIT_SALT` | 16+ caracteres |
| `CRON_SECRET` | 16+ caracteres |
| `SENTRY_DSN` | se o Sentry estiver ligado |

O jeito mais rápido é copiar os valores da Vercel (*Settings → Environment
Variables*). `URL` não se cadastra: a Netlify define sozinha (é o domínio
principal do site, usado pela tarefa diária).

## 3. Domínio

Estrutura: `vitrimove.site` (página institucional, que já existe no app),
`app.vitrimove.site` (painel) e `<subdominio>.vitrimove.site` (vitrines). O DNS
fica no Cloudflare. Todos os registros apontando para a Netlify ficam **DNS only**
(nuvem cinza): o proxy laranja atrapalha o certificado da Netlify.

1. Netlify → *Domain management → Add a domain* → `app.vitrimove.site` e deixe-o
   como **domínio principal** (a tarefa diária chama o domínio principal).
2. Netlify → *Add domain alias* → `vitrimove.site` e `www.vitrimove.site`.
3. Cloudflare DNS (zona `vitrimove.site`):

   | Tipo | Nome | Destino | Proxy |
   |---|---|---|---|
   | CNAME | `app` | `<nome-do-site>.netlify.app` | DNS only |
   | CNAME | `@` | `apex-loadbalancer.netlify.com` (o Cloudflare achata) | DNS only |
   | CNAME | `www` | `<nome-do-site>.netlify.app` | DNS only |

   Não crie registro curinga `*`: sem plano Pro a Netlify não atende o curinga.
4. Na Netlify, espere o certificado (Let's Encrypt) de cada nome sair em *HTTPS*.

O `agenn.com.br` deixa de ser usado pelo app. `LEGACY_DOMAINS` fica vazio.

## 4. Supabase, Stripe, Mux, Resend e outros

- **Supabase → Authentication → URL Configuration:** Site URL
  `https://app.vitrimove.site`; Redirect URLs `https://app.vitrimove.site/**`
  (tire as de `agenn.com.br` quando a virada terminar). Para testar login no
  endereço `.netlify.app`, acrescente `https://<nome-do-site>.netlify.app/**`.
  Se o SMTP do Supabase usa o Resend, troque o remetente para
  `nao-responda@vitrimove.site`.
- **Stripe → Webhooks:** crie o endpoint
  `https://app.vitrimove.site/api/webhooks/stripe` com os mesmos eventos do
  antigo, copie o novo `whsec_...` para `STRIPE_WEBHOOK_SECRET` e depois apague
  o endpoint antigo. As URLs de retorno do checkout e do portal saem de
  `NEXT_PUBLIC_ROOT_DOMAIN`; não se cadastram. No **Customer portal**, troque a URL
  de retorno padrão para `https://app.vitrimove.site/painel/plano` e os links
  de termos/privacidade para `https://app.vitrimove.site/termos` e `/privacidade`.
  Em *Business details*, o site passa a ser `https://vitrimove.site`.
- **Mux → Webhooks:** novo endpoint `https://app.vitrimove.site/api/webhooks/mux`;
  o novo signing secret vai para `MUX_WEBHOOK_SECRET`.
- **Resend:** adicione o domínio `vitrimove.site`, crie no Cloudflare os
  registros que o Resend mostrar (SPF/DKIM/MX) e troque `EMAIL_FROM`.
- **E-mails de contato:** os textos legais citam `suporte@vitrimove.site` e
  `privacidade@vitrimove.site`. Crie as caixas ou use o Cloudflare Email Routing
  (gratuito) para encaminhar ao seu e-mail.
- **Google (se ligado):** origem JavaScript autorizada
  `https://app.vitrimove.site`. O redirect continua sendo o do Supabase.
- **Turnstile (se ligado):** hostnames `vitrimove.site` e `app.vitrimove.site`.
- **Bunny:** se a Pull Zone tiver proteção de hotlink/referrer, inclua
  `vitrimove.site` e `*.vitrimove.site`.

Depois da virada, desligue o deploy automático na Vercel (ou apague o projeto)
para o Vercel Cron não rodar a tarefa diária duas vezes.

## 5. Cadastrar a vitrine de um cliente novo

Depois que o cliente escolher o subdomínio no painel (ex.: `ananails`):

1. **Netlify** → *Domain management → Add a domain alias* → `ananails.vitrimove.site`.
2. **Cloudflare DNS** → *Add record*: tipo `CNAME`, nome `ananails`, destino
   `<nome-do-site>.netlify.app`, proxy **DNS only**.
3. Espere o certificado da Netlify cobrir o novo nome (alguns minutos) e abra
   `https://ananails.vitrimove.site`.

Nada no Supabase, no Stripe nem no código. Se o cliente trocar o subdomínio,
repita com o nome novo e remova o antigo.

## 6. Limites do plano Free

- 300 créditos/mês, com teto rígido: deploy de produção = 15 créditos, 1 GB de
  tráfego = 20, 10 mil requisições = 2. Deploy previews não gastam.
  Acompanhe em *Usage*.
- Funções rodam nos EUA (escolher região é só no Pro); o Supabase está em São
  Paulo, então as páginas dinâmicas ficam um pouco mais lentas que na Vercel (`gru1`).
- 60 s por requisição; a scheduled function tem 30 s.

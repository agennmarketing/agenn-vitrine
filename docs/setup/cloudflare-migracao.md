# Migrar a hospedagem da Vercel para o Cloudflare

O código já está preparado: o que falta é criar as coisas na conta do Cloudflare e
virar o DNS. **Nada aqui derruba a Vercel** — dá para publicar no Cloudflare, testar
no endereço `*.workers.dev` e só depois apontar o domínio. Se der errado, o DNS volta
para a Vercel e tudo segue como antes.

## O que mudou no projeto

| Arquivo | Para quê |
| --- | --- |
| `open-next.config.ts` | Adaptador OpenNext: cache das páginas em R2 e cache de tags em D1 |
| `wrangler.jsonc` | Configuração do Worker do app (ids a preencher) |
| `workers/cron-diaria/` | Worker da tarefa diária (o Cloudflare não tem "cron que chama uma URL") |
| `package.json` | Scripts `cf:build`, `cf:preview`, `cf:deploy` e `cf:deploy-cron` |
| `APP_ENV` | Onde o código olhava `VERCEL_ENV`, agora olha `APP_ENV` primeiro |

`vercel.json` continua no lugar: enquanto o domínio estiver na Vercel, é ele que vale.

## Por que Workers e não Pages

O Cloudflare Pages com `@cloudflare/next-on-pages` exige que **toda** rota rode no
runtime Edge. Este app não roda: usa o SDK do Stripe, o cliente admin do Supabase,
`crypto`, `Buffer` e leitura de imagem em Node. Passar tudo para Edge seria reescrever
o servidor inteiro.

O caminho que funciona é **Cloudflare Workers com `@opennextjs/cloudflare`** (já
instalado), que roda o Next com `nodejs_compat` — App Router, middleware (`src/proxy.ts`),
Server Actions e revalidação por tag continuam como estão.

## Passo a passo

### 1. Criar os recursos

```bash
npx wrangler login
npx wrangler r2 bucket create vitrimove-cache
npx wrangler d1 create vitrimove-tags
```

Copie o `database_id` que o D1 imprimir para `wrangler.jsonc` (campo
`A PREENCHER — id do banco D1`).

### 2. Variáveis e segredos

As mesmas da Vercel, com uma a mais (`APP_ENV=production`). As públicas
(`NEXT_PUBLIC_*`) entram **em tempo de build**, então precisam estar no ambiente que
roda `npm run cf:build`; as secretas entram como segredo do Worker:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put BUNNY_STORAGE_PASSWORD
npx wrangler secret put MUX_TOKEN_SECRET
npx wrangler secret put MUX_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RATE_LIMIT_SALT
npx wrangler secret put CRON_SECRET
```

Lista completa das variáveis: `docs/setup/fase-5-infra.md` §7 e `.env.example`.

### 3. Publicar e testar sem mexer no domínio

```bash
npm run cf:build
npm run cf:preview   # roda local, no mesmo runtime do Cloudflare
npm run cf:deploy    # publica em vitrimove.<sua-conta>.workers.dev
```

No endereço `*.workers.dev` o proxy abre direto a área do painel (é o mesmo
comportamento que já existia para as prévias da Vercel), o que serve para conferir
login, painel e agenda. A **vitrine pública depende de subdomínio**, então ela só dá
para conferir de verdade depois do passo 4.

### 4. Domínios

No painel do Cloudflare, em Workers & Pages → o worker → Settings → Domains & Routes,
adicione:

- `app.agenn.com.br`
- `*.agenn.com.br` (a vitrine de cada lojista)

Como o DNS do domínio já está no Cloudflare, o registro vira "Worker" e o proxy
(nuvem laranja) fica ligado. O apex `agenn.com.br` **não é nosso** — é o site do
usuário — e não deve ser tocado.

Depois que responder, remova os domínios do projeto da Vercel para não ficarem dois
donos do mesmo endereço.

### 5. Tarefa diária

```bash
npx wrangler secret put CRON_SECRET --config workers/cron-diaria/wrangler.jsonc
npm run cf:deploy-cron
```

Confira o horário em `workers/cron-diaria/wrangler.jsonc` (07:00 UTC = 04:00 em
Brasília, igual ao `vercel.json`).

### 6. Webhooks

Os endereços não mudam (`/api/webhooks/stripe` e `/api/webhooks/mux`), mas eles
apontam para `app.agenn.com.br` — só funcionam depois do passo 4. Não é preciso mexer
no Stripe nem no Mux, desde que o domínio continue o mesmo.

### 7. Texto legal

`src/lib/legal/privacy.ts` diz que a hospedagem é a Vercel. Quando a virada estiver
feita, troque "Vercel (hospedagem do site)" por "Cloudflare (hospedagem do site)" e
mude `LEGAL_VERSION` em `src/lib/legal/company.ts`.

## O que fica diferente e você precisa saber

- **Prévias por pull request**: a Vercel criava uma URL por PR sozinha. No Cloudflare
  isso não vem de graça — ou se usa "Workers Builds" ligado ao GitHub, ou as prévias
  deixam de existir. O CI atual (lint, tipos, testes, e2e) não depende disso.
- **Limite de tempo por requisição**: o plano gratuito do Workers dá 10 ms de CPU por
  requisição; o plano pago (US$ 5/mês) dá 30 s. Com Stripe e Supabase no caminho, o
  **plano pago é necessário**.
- **Tamanho do worker**: o app compactado precisa caber em 3 MB (gratuito) ou 10 MB
  (pago). Mais um motivo para o plano pago.
- **Sentry**: o SDK do Next funciona no Workers, mas o `instrumentation` de servidor
  tem suporte parcial. Se o Sentry do servidor parar de registrar, não é o app que
  quebrou — confira antes de investigar outra coisa.
- **R2 e D1 cobram por uso**, mas nesse tamanho de projeto ficam dentro da faixa
  gratuita.

## Se der errado

O DNS volta para a Vercel (os registros `app` e `*` como CNAME para
`cname.vercel-dns.com`, proxy desligado) e o projeto na Vercel volta a responder, com
o código exatamente como está. Nada no banco muda com a hospedagem.

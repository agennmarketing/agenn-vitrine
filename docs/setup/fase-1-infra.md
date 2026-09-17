# Fase 1: Infraestrutura de produção

Guia passo a passo para colocar a Fase 1 da Agenn Vitrine em produção em `agenn.com.br`. Escrito para quem está montando o projeto pela primeira vez — siga as seções em ordem.

## 1. Supabase (projeto de produção)
1. Crie o projeto na região **South America (São Paulo)**.
2. Vincule o projeto e aplique as migrações:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://app.agenn.com.br`
   - Redirect URLs: `https://app.agenn.com.br/auth/callback`
4. Em **Authentication → Emails → Templates**, cole o conteúdo de `supabase/templates/confirmacao.html` (Confirm signup) e `supabase/templates/recuperacao.html` (Reset password), com os assuntos do `config.toml`.
5. Em **Authentication → Providers → Email**: confirmação de e-mail ligada e senha mínima de 8.
6. Em **Authentication → SMTP**, use o SMTP do Resend (seção 3).
7. Em **Authentication → Attack Protection**, ligue o CAPTCHA **Turnstile** com a secret key (seção 4).
8. Em **Authentication → Providers → Google**, ligue o provedor com Client ID e Secret (seção 5).

## 2. Vercel
1. Importe o repositório e use Node 20+.
2. Domínios: `agenn.com.br`, `app.agenn.com.br` e `*.agenn.com.br`. O domínio curinga exige que o DNS do domínio use os **nameservers da Vercel**.
3. Variáveis de ambiente (Production):
   - `NEXT_PUBLIC_ROOT_DOMAIN=agenn.com.br`
   - `LEGACY_DOMAINS=` (vazio)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
   - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
4. **Importante sobre o Sentry:** defina `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` no ambiente **Production** (e em Preview também, se quiser Sentry nas prévias) e marque-as para estarem disponíveis **em tempo de build**, não só em runtime. O motivo é que `next.config.ts` decide, durante o próprio `next build`, se usa o SDK real do Sentry ou um stub no-op — se o DSN só existir em runtime, o build já terá sido gerado sem o Sentry. Se um build de produção rodar sem essas variáveis, o log de build mostra o aviso `[sentry] VERCEL_ENV=production sem SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN: o Sentry ficará desligado neste build.` — isso é o sinal de que as variáveis não chegaram ao build.

## 3. Resend
1. Adicione o domínio `agenn.com.br` e configure os registros DNS (SPF, DKIM).
2. Remetente: `Agenn Vitrine <nao-responda@agenn.com.br>`.
3. Gere as credenciais SMTP e use-as no Supabase (seção 1.6).

## 4. Cloudflare Turnstile
1. Crie um widget **Managed** para os hostnames `agenn.com.br` e `app.agenn.com.br`.
2. A site key vai em `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e a secret key no Supabase (seção 1.7).

## 5. Google OAuth
1. No Google Cloud Console, crie a tela de consentimento (nome "Agenn Vitrine") e credenciais **OAuth Client ID (Web)**.
2. Origem JavaScript autorizada: `https://app.agenn.com.br`.
3. URI de redirecionamento autorizado: `https://<ref>.supabase.co/auth/v1/callback`.

## 6. Sentry
Crie o projeto Next.js e copie DSN, org, project e auth token para a Vercel. Confira o alerta da seção 2.4 acima: sem `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` disponíveis no build, o Sentry fica desligado mesmo que as variáveis existam em runtime.

## 7. Conferência em produção
- [ ] `https://agenn.com.br` mostra a página inicial
- [ ] `https://qualquer.agenn.com.br` mostra "Vitrine não encontrada"
- [ ] Cadastro recebe e-mail do Resend e o link leva ao painel
- [ ] E-mail de confirmação e de recuperação chegam com o texto e o link corretos (modelos em `supabase/templates`)
- [ ] "Continuar com Google" entra e a página Conta **não** mostra "Senha"
- [ ] Login em outro navegador derruba o primeiro com "Sua conta foi acessada em outro aparelho."
- [ ] Recuperação de senha funciona

## Migração futura para agennvitrine.com.br
Siga a seção 2.2 da spec: novo domínio e curinga na Vercel, `NEXT_PUBLIC_ROOT_DOMAIN=agennvitrine.com.br`, `LEGACY_DOMAINS=agenn.com.br`, e atualização de Supabase (Site URL e Redirect URLs), Google OAuth, Resend e Turnstile.

## Desenvolvimento local

Nesta máquina o repositório vive em um drive **FAT32** (`E:\`). Isso traz duas limitações que não existem em produção nem em um checkout normal:

- O Docker Desktop não consegue montar `supabase/templates` no container do Supabase local (o bind mount não reflete o conteúdo do drive), então os e-mails de confirmação e recuperação exibidos localmente pelo Mailpit aparecem com o corpo padrão do Supabase, e não com os modelos em `supabase/templates`. O serviço de e-mail de teste local pode aparecer como `[local_smtp]` no `supabase/config.toml` dependendo da versão do CLI. Os modelos reais só são conferidos na checklist de produção (seção 7 acima), colando o conteúdo diretamente no painel do Supabase.
- `supabase test db` também depende de um bind mount que não reflete o conteúdo do drive, então `npm run test:db` usa `scripts/test-db.mjs`: ele copia os arquivos de `supabase/tests/database` para dentro do container com `docker cp` e roda cada um com `psql`, reproduzindo o mesmo resultado que `pg_prove` daria.

Se o projeto for movido para um disco fixo **NTFS**, essas duas dificuldades desaparecem: o bind mount volta a refletir os arquivos do repo, os e-mails locais passam a usar os modelos reais e `npm run test:db` pode voltar a ser simplesmente `supabase test db`.

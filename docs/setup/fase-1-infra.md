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
9. Em **Authentication → Providers → Email**, mantenha **Secure email change** ligado. Assim, mesmo com uma sessão roubada, ninguém troca o e-mail da conta pela API sem confirmar nos dois endereços (o app não permite trocar o e-mail).
10. Em **Project Settings → JWT Keys**, migre o projeto para **chaves de assinatura assimétricas** (JWT Signing Keys, ex.: ECC P-256): crie a nova chave, espere alguns minutos e **rotacione** para ela. Com chave assimétrica, `getClaims()` no proxy valida o token localmente (pela chave pública/JWKS) em vez de chamar o Auth a cada requisição. O Supabase local já usa ES256.

## 2. Vercel
1. Importe o repositório e use Node 20+. O arquivo `vercel.json` do repositório fixa as funções na região `gru1` (São Paulo), a mesma do Supabase — confira em **Settings → Functions** que a região ficou `gru1`.
2. Domínios: `agenn.com.br`, `app.agenn.com.br` e `*.agenn.com.br`. O domínio curinga exige que o DNS do domínio use os **nameservers da Vercel**.
3. Variáveis de ambiente (Production):
   - `NEXT_PUBLIC_ROOT_DOMAIN=agenn.com.br`
   - `LEGACY_DOMAINS=` (vazio)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
   - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
4. **Variáveis e deploy:** as variáveis de ambiente normais da Vercel já ficam disponíveis durante o build. Só garanta que estão definidas no ambiente **Production** (e em **Preview**, se usar prévias) **antes** do deploy, e faça **redeploy** depois de alterar qualquer uma — o deploy existente não muda sozinho. Isso vale em especial para:
   - **Sentry:** `next.config.ts` decide, durante o próprio `next build`, se usa o SDK real ou um stub no-op. Se o build rodar sem `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, o log mostra `[sentry] VERCEL_ENV=production sem SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN: o Sentry ficará desligado neste build.`
   - **Qualquer `NEXT_PUBLIC_*`** (ex.: `NEXT_PUBLIC_ROOT_DOMAIN` na migração de domínio): o valor é gravado no código no build, então a mudança só vale após novo deploy.
5. **Prévias (`*.vercel.app`):** na Fase 1 o proxy só reconhece o domínio raiz e seus subdomínios, então os endereços de Preview da Vercel caem em "Página não encontrada". Teste pelo domínio de produção ou localmente.

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
Crie o projeto Next.js e copie DSN, org, project e auth token para a Vercel. Confira a seção 2.4: defina `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` no ambiente certo antes do deploy (ou faça redeploy depois), senão o build sai com o Sentry desligado. Erros registrados com `console.error` no servidor também são enviados ao Sentry.

## 7. Conferência em produção
- [ ] `https://agenn.com.br` mostra a página inicial
- [ ] `https://qualquer.agenn.com.br` mostra "Vitrine não encontrada"
- [ ] Cadastro recebe e-mail do Resend e o link leva ao painel
- [ ] E-mail de confirmação e de recuperação chegam com o texto e o link corretos (modelos em `supabase/templates`)
- [ ] "Continuar com Google" entra e a página Conta **não** mostra "Senha"
- [ ] Login em outro navegador derruba o primeiro com "Sua conta foi acessada em outro aparelho."
- [ ] Recuperação de senha funciona
- [ ] Logado com senha, abrir `https://app.agenn.com.br/redefinir-senha` leva para Conta (nova senha sem a atual só pelo link do e-mail)

## Riscos aceitos
- **Troca de senha direto pela API do Supabase:** a tela `/redefinir-senha` só aceita sessões abertas por link de e-mail há até 15 minutos, e a página Conta pede a senha atual. Mesmo assim, quem tiver uma sessão válida (ex.: cookie roubado) ainda consegue chamar a API do Supabase Auth diretamente (`PUT /auth/v1/user`) e trocar a senha sem informar a atual. Recomendação para a fase de endurecimento: ligar **Secure password change** em **Authentication → Providers → Email** (exige login recente ou código de reautenticação para trocar a senha) e conferir que a recuperação por e-mail continua funcionando.

## Migração futura para agennvitrine.com.br
Siga a seção 2.2 da spec: novo domínio e curinga na Vercel, `NEXT_PUBLIC_ROOT_DOMAIN=agennvitrine.com.br`, `LEGACY_DOMAINS=agenn.com.br`, e atualização de Supabase (Site URL e Redirect URLs), Google OAuth, Resend e Turnstile.

## Desenvolvimento local

Nesta máquina o repositório vive em um drive **FAT32** (`E:\`). Isso traz duas limitações que não existem em produção nem em um checkout normal:

- O Docker Desktop não consegue montar `supabase/templates` no container do Supabase local (o bind mount não reflete o conteúdo do drive), então os e-mails de confirmação e recuperação exibidos localmente pelo Mailpit aparecem com o corpo padrão do Supabase, e não com os modelos em `supabase/templates`. O serviço de e-mail de teste local pode aparecer como `[local_smtp]` no `supabase/config.toml` dependendo da versão do CLI. Os modelos reais só são conferidos na checklist de produção (seção 7 acima), colando o conteúdo diretamente no painel do Supabase.
- `supabase test db` também depende de um bind mount que não reflete o conteúdo do drive, então `npm run test:db` usa `scripts/test-db.mjs`: ele copia os arquivos de `supabase/tests/database` para dentro do container com `docker cp` e roda cada um com `psql`, reproduzindo o mesmo resultado que `pg_prove` daria.

Se o projeto for movido para um disco fixo **NTFS**, essas duas dificuldades desaparecem: o bind mount volta a refletir os arquivos do repo, os e-mails locais passam a usar os modelos reais e `npm run test:db` pode voltar a ser simplesmente `supabase test db`.

# Fase 6 — Acabamento: termos, excluir conta, QR Code e indexação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plataforma fica pronta para cobrar de verdade: termos de uso e política de privacidade publicados e ligados ao cadastro, "Excluir conta" que cancela a assinatura no Stripe e apaga dados e mídias, QR Code de cada vitrine gerado no navegador, `robots.txt` e `sitemap.xml` por vitrine, prévias da Vercel utilizáveis e as checagens de disponibilidade fora das Server Actions.

**Architecture:** Mesmo app Next.js 16 das fases anteriores, sem tabela nova — a única mudança no banco é uma função para apagar a conta com segurança. As páginas legais são estáticas na rota do site (`/site/termos`, `/site/privacidade`), com a data de versão numa constante única. "Excluir conta" é uma Server Action que cancela no Stripe, remove os arquivos do Bunny e apaga o usuário pela Admin API (o resto cai por `on delete cascade`). O QR Code é gerado no cliente com `qrcode` carregado sob demanda. `robots.txt` e `sitemap.xml` viram rotas dentro de `/v/[subdomain]`, `/app` e `/site`, o que exige soltar `.txt`/`.xml` no matcher do proxy. As checagens de subdomínio e de código de item passam a ser rotas GET com `AbortController`, acabando com o ruído "Failed to find Server Action".

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + RLS), Stripe, `qrcode`, Zod, Vitest, Playwright, pgTAP, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-agenn-vitrine-design.md`. Seções usadas: 2.1 e 2.2 (hosts e links montados a partir de `ROOT_DOMAIN`), 5.1 (código do item), 8.1 (cadastro), 8.2 (QR Code no card da vitrine), 8.8 (excluir conta), 11 e 12 (Fase 6).

**Base:** Fases 1–5 concluídas (PRs até #35, merge `d33e6f8`). Planos anteriores em `docs/superpowers/plans/`. Guias em `docs/setup/`.

**Fora desta fase, por decisão do usuário:** otimização de desempenho e Lighthouse CI (spec 7.6 e 11) entram na **fase de design**, junto do visual — imagens, fontes e animações mexem nos mesmos números. A meta de nota 90 continua valendo, só muda de fase.

---

## Como trabalhar nesta fase

Igual às Fases 2 a 5:

- Uma branch e um PR por bloco: `fase-6/bloco-N-<nome>`.
- Localmente `npm run lint`, `npm run typecheck`, `npm test` e, quando a mudança criar rota, `npm run build`.
- **Dá para rodar o Playwright localmente** contra o Supabase dev da nuvem, o que é bem mais rápido que uma rodada de CI para depurar:
  `CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake npx playwright test e2e/<arquivo> --project=desktop`
- **Rotina de migração** (só o Bloco 2 tem): push → job `db` falha no diff de tipos → `gh run download <run-id> --name database-types --dir <scratchpad>/types` → copiar para `src/lib/supabase/database.types.ts` → commit.
- Merge só com CI verde e autorização do usuário. `gh` em `C:\Program Files\GitHub CLI`.

**Lições das fases anteriores que valem aqui:**
- `redirect()` de Server Action para URL do **mesmo domínio** que seja rota de API vira navegação do roteador e quebra; devolva a URL e navegue com `window.location.assign`.
- O stub do Sentry (`src/lib/monitoring/sentry-noop.ts`) precisa exportar cada membro `Sentry.*` novo, senão o build quebra. Rode `npm run build` depois de criar rotas.
- Sentry é no-op no CI: erros de rota só aparecem se houver `console.error` no catch.
- Vitrine congelada responde 200 com "Vitrine indisponível no momento" (spec 7.1); 404 é só subdomínio inexistente.
- `formatBRL` usa espaço não separável (`\u00A0`): no Playwright, casar por regex.
- `getByLabel` casa por trecho: use `{ exact: true }` quando um rótulo é começo de outro.
- Nunca editar arquivo com crases/`$` por `node -e` dentro de aspas duplas no bash: usar as ferramentas de edição.

---

## Global Constraints

- **Idioma:** textos visíveis em português do Brasil; identificadores em inglês.
- **Nenhum domínio fixo no código (spec 2.2):** todo link absoluto sai de `buildAppUrl`/`buildVitrineUrl` com `NEXT_PUBLIC_ROOT_DOMAIN`. Isso vale especialmente para o QR Code e para o `sitemap.xml`.
- **Textos legais são rascunho:** o conteúdo entregue aqui é um ponto de partida escrito para o mercado brasileiro (LGPD, CDC), **não é parecer jurídico** e precisa de revisão profissional antes de cobrar de verdade. Os dados da empresa ficam num único lugar (`src/lib/legal/company.ts`) e são preenchidos pelo usuário.
- **Versão dos textos:** cada página mostra "Última atualização: DD/MM/AAAA", vinda de uma constante; mudar o texto exige mudar a data.
- **Aceite:** o cadastro não ganha caixa de seleção; abaixo do botão fica "Ao criar a conta, você concorda com os Termos de uso e a Política de privacidade", com links. Aceite por ação, como é praxe em SaaS.
- **Excluir conta (spec 8.8):** cancela a assinatura no Stripe (sem apagar o Customer, para preservar o histórico fiscal), apaga arquivos do Storage e vídeos do Stream, apaga o usuário em `auth.users` — o resto cai por `on delete cascade` — e encerra a sessão. Confirmação digitando o e-mail da conta.
- **`item_codes` nunca é reaproveitada (spec 5.1):** ao apagar a conta ela cai junto (é do dono), o que é correto: os códigos eram únicos por conta.
- **QR Code (spec 8.2):** gerado no navegador, sem serviço externo, apontando para a URL pública da vitrine; permite baixar em PNG.
- **`robots.txt` e `sitemap.xml`:** vitrine e site liberados; `app.` bloqueado por completo. O `sitemap.xml` da vitrine lista a página e cada item por `?item={código}`.
- **Vitrine congelada ou inexistente:** `robots.txt` responde `Disallow: /` e o `sitemap.xml` responde 404 — não faz sentido indexar o que não está no ar.
- **Checagens de disponibilidade:** rotas GET autenticadas, com `AbortController` no cliente; nada de Server Action com debounce.
- **Segurança:** as rotas novas de disponibilidade exigem sessão e usam o cliente do usuário (RLS e grants valem); a exclusão de conta usa o cliente admin só depois de confirmar o dono pelo cookie de sessão.
- **Design:** sem etapas de refinamento visual (fase de design dedicada depois).

---

## Decisões desta fase

| Tema | Decisão | Motivo |
|---|---|---|
| Texto legal | Rascunho escrito aqui, com `{{RAZAO_SOCIAL}}`, `{{CNPJ}}`, `{{ENDERECO}}` e `{{EMAIL_CONTATO}}` preenchidos num único arquivo | O usuário revisa e completa sem mexer em JSX. |
| Onde ficam as páginas | `agenn.com.br/termos` e `/privacidade` (host do site) | São da plataforma, não do painel; ficam públicas e indexáveis. |
| Aceite no cadastro | Frase com links abaixo do botão, sem checkbox | Não muda o fluxo nem os testes do cadastro; é o padrão de mercado. |
| Cancelamento no Stripe ao excluir | `subscriptions.cancel` e mantém o Customer | Histórico de faturas continua disponível para contabilidade. |
| Evento tardio do Stripe | Depois de apagar a conta, um `customer.subscription.deleted` pode chegar sem dono; o webhook já responde `ignored` | Comportamento esperado, não é erro. |
| Confirmação da exclusão | Digitar o e-mail da conta | Mesmo padrão de excluir vitrine (que pede o subdomínio). |
| Biblioteca do QR | `qrcode` (^1.5.4), carregada com `import()` dentro do componente | Fica fora do pacote inicial do painel. |
| `robots`/`sitemap` | Rotas por host dentro de `/v/[subdomain]`, `/app` e `/site` | O matcher do proxy passa a deixar `.txt` e `.xml` entrarem. |
| Prévias da Vercel | Host terminado em `.vercel.app` resolve como `app` | Permite testar o painel numa prévia de PR; vitrines seguem exigindo subdomínio. |
| Disponibilidade | `GET /api/disponibilidade/subdominio` e `/codigo` | Acaba o "Failed to find Server Action" e o `AbortController` cancela a checagem antiga. |

---

## Mapa de arquivos

```
supabase/tests/database/11_account_deletion.test.sql    # prova que apagar o usuário limpa tudo (sem migração nova)

src/lib/legal/company.ts                          # dados da empresa e data de versão (+ test)
src/lib/legal/terms.tsx                           # texto dos termos de uso
src/lib/legal/privacy.tsx                         # texto da política de privacidade
src/app/site/termos/page.tsx
src/app/site/privacidade/page.tsx
src/app/site/page.tsx                             # rodapé com os links
src/app/app/(auth)/cadastro/sign-up-form.tsx      # aviso de aceite
src/app/app/(painel)/painel/conta/page.tsx        # bloco "Excluir conta" + links legais
src/app/app/(painel)/painel/conta/delete-account-form.tsx

src/features/account/delete-account.ts            # cancela no Stripe, apaga mídias e o usuário
src/features/account/actions.ts                   # deleteAccountAction
src/lib/billing/billing.ts                        # + cancelSubscription
src/lib/billing/stripe-billing.ts                 # + cancelSubscription
src/lib/billing/fake-billing.ts                   # + cancelSubscription

src/app/app/(painel)/painel/qr-code-button.tsx    # diálogo com o QR e download
src/app/app/(painel)/painel/page.tsx              # botão no card da vitrine

src/lib/hosts/parse-host.ts                       # *.vercel.app resolve como app (+ test)
src/proxy.ts                                      # matcher deixa passar .txt e .xml
src/app/v/[subdomain]/robots.txt/route.ts
src/app/v/[subdomain]/sitemap.xml/route.ts
src/app/site/robots.txt/route.ts
src/app/site/sitemap.xml/route.ts
src/app/app/robots.txt/route.ts
src/lib/public/robots.ts                          # corpo do robots.txt (+ test)
src/lib/public/sitemap.ts                         # corpo do sitemap.xml (+ test)

src/app/api/disponibilidade/subdominio/route.ts
src/app/api/disponibilidade/codigo/route.ts
src/lib/forms/availability.ts                     # checagem com AbortController (+ test)
src/app/app/(painel)/painel/vitrines/nova/wizard.tsx
src/app/app/(painel)/painel/vitrines/[id]/configuracoes/settings-form.tsx
src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx
src/features/vitrines/actions.ts                  # remove checkSubdomainAction
src/features/items/actions.ts                     # remove checkItemCodeAction

e2e/legal.spec.ts
e2e/account-delete.spec.ts
e2e/qr-code.spec.ts
e2e/robots-sitemap.spec.ts
e2e/helpers.ts                                    # countUserRows
docs/setup/fase-6-conferencia.md
```

---
# Bloco 0 — Termos de uso e política de privacidade

Branch: `fase-6/bloco-0-legal`.

Este bloco é o que destrava cobrar de verdade. O texto é rascunho: revisão profissional antes do lançamento.

### Task 1: Dados da empresa e textos legais

**Files:**
- Create: `src/lib/legal/company.ts`, `src/lib/legal/company.test.ts`, `src/lib/legal/terms.ts`, `src/lib/legal/privacy.ts`, `src/lib/legal/legal.test.ts`

**Interfaces:**
- Produces:
  - `COMPANY: { legalName: string; tradeName: string; cnpj: string; address: string; contactEmail: string; privacyEmail: string }`
  - `LEGAL_VERSION: string` (ISO `AAAA-MM-DD`) e `LEGAL_VERSION_LABEL: string` (`DD/MM/AAAA`)
  - `type LegalSection = { title: string; paragraphs: string[] }`
  - `TERMS: LegalSection[]`, `PRIVACY: LegalSection[]`

- [ ] **Step 1: Teste que falha para os dados da empresa**

`src/lib/legal/company.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { COMPANY, LEGAL_VERSION, LEGAL_VERSION_LABEL } from './company'

describe('dados da empresa', () => {
  it('tem todos os campos preenchidos ou marcados para preencher', () => {
    for (const value of Object.values(COMPANY)) {
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('versão em ISO e rótulo no formato brasileiro', () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(LEGAL_VERSION_LABEL).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    const [ano, mes, dia] = LEGAL_VERSION.split('-')
    expect(LEGAL_VERSION_LABEL).toBe(`${dia}/${mes}/${ano}`)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/legal/company.test.ts`
Expected: FAIL — o módulo `./company` não existe.

- [ ] **Step 3: Implementar os dados da empresa**

`src/lib/legal/company.ts`:

```ts
// Único lugar com os dados da empresa. Enquanto estiver com "A PREENCHER", os
// textos legais não estão prontos para o lançamento.
export const COMPANY = {
  legalName: 'A PREENCHER — razão social',
  tradeName: 'Agenn Vitrine',
  cnpj: 'A PREENCHER — 00.000.000/0001-00',
  address: 'A PREENCHER — endereço completo',
  contactEmail: 'suporte@agenn.com.br',
  privacyEmail: 'privacidade@agenn.com.br',
}

// Mudou o texto? Mude a data. É ela que aparece como "Última atualização".
export const LEGAL_VERSION = '2026-09-18'

const [ano, mes, dia] = LEGAL_VERSION.split('-')
export const LEGAL_VERSION_LABEL = `${dia}/${mes}/${ano}`
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/legal/company.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste que falha para os textos**

`src/lib/legal/legal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { COMPANY } from './company'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'

describe.each([
  ['termos de uso', TERMS],
  ['política de privacidade', PRIVACY],
])('%s', (_nome, sections) => {
  it('tem seções com título e conteúdo', () => {
    expect(sections.length).toBeGreaterThan(5)
    for (const section of sections) {
      expect(section.title.trim().length).toBeGreaterThan(0)
      expect(section.paragraphs.length).toBeGreaterThan(0)
      for (const paragraph of section.paragraphs) expect(paragraph.trim().length).toBeGreaterThan(0)
    }
  })

  it('cita a empresa e o contato', () => {
    const texto = sections.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain(COMPANY.legalName)
    expect(texto).toContain(COMPANY.tradeName)
  })
})

describe('termos de uso', () => {
  it('fala de renovação automática, cancelamento e arrependimento', () => {
    const texto = TERMS.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('renovação automática')
    expect(texto).toContain('7 dias')
  })

  it('explica o que acontece ao voltar para o gratuito', () => {
    const texto = TERMS.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('90 dias')
    expect(texto).toContain('marca d’água')
  })
})

describe('política de privacidade', () => {
  it('lista os operadores e os direitos da LGPD', () => {
    const texto = PRIVACY.flatMap((section) => section.paragraphs).join(' ')
    for (const parceiro of ['Supabase', 'Vercel', 'Bunny', 'Stripe', 'Resend', 'Cloudflare']) {
      expect(texto).toContain(parceiro)
    }
    expect(texto).toContain('LGPD')
  })

  it('deixa claro que não guardamos dados do cliente final nem cartão', () => {
    const texto = PRIVACY.flatMap((section) => section.paragraphs).join(' ')
    expect(texto).toContain('não guardamos')
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/legal/legal.test.ts`
Expected: FAIL — `./terms` e `./privacy` não existem.

- [ ] **Step 7: Escrever os termos de uso**

`src/lib/legal/terms.ts`:

```ts
import { COMPANY } from './company'

export type LegalSection = { title: string; paragraphs: string[] }

// Rascunho para revisão jurídica. Mudou aqui, mude LEGAL_VERSION em company.ts.
export const TERMS: LegalSection[] = [
  {
    title: '1. Quem somos',
    paragraphs: [
      `O ${COMPANY.tradeName} é um serviço de ${COMPANY.legalName}, inscrita no CNPJ ${COMPANY.cnpj}, com endereço em ${COMPANY.address}.`,
      `O serviço permite criar vitrines e cardápios na internet, com fotos e vídeos, e receber pedidos e orçamentos pelo WhatsApp. Ao criar uma conta, você concorda com estes Termos de uso. Dúvidas: ${COMPANY.contactEmail}.`,
    ],
  },
  {
    title: '2. Conta e acesso',
    paragraphs: [
      'Para usar o serviço é preciso ter 18 anos ou mais, informar dados verdadeiros e confirmar o e-mail.',
      'Cada conta é usada em um aparelho por vez: ao entrar em um novo aparelho, a sessão anterior é encerrada. Você é responsável por manter sua senha em segredo e por tudo que acontece na sua conta.',
      'Você pode encerrar sua conta quando quiser, pelo painel, em Conta → Excluir conta.',
    ],
  },
  {
    title: '3. Planos, preços e pagamento',
    paragraphs: [
      'Existe um plano Gratuito e um plano Pro. Os limites de cada um estão descritos no painel e podem mudar; mudanças que reduzam limites de planos já contratados são avisadas com antecedência.',
      'O Pro custa R$ 149,90 por mês ou R$ 1.499,00 por ano, com renovação automática ao fim de cada período, até que você cancele. O pagamento é feito com cartão de crédito, processado pela Stripe; não temos acesso ao número do seu cartão.',
      'Reajustes de preço são avisados por e-mail com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte.',
      'Se a cobrança falhar, tentamos novamente por até 7 dias. Nesse período o Pro continua valendo. Sem sucesso, a assinatura é cancelada e a conta volta ao Gratuito.',
    ],
  },
  {
    title: '4. Cancelamento e arrependimento',
    paragraphs: [
      'Você pode cancelar quando quiser pelo painel, em Plano e assinatura → Gerenciar assinatura. O cancelamento vale no fim do período já pago, e não há cobrança depois disso.',
      'Fora do prazo de arrependimento, não há devolução proporcional do período já pago.',
      'Se a contratação foi feita pela internet, você pode desistir em até 7 dias corridos, contados da contratação, com devolução integral do valor pago (art. 49 do Código de Defesa do Consumidor). Basta pedir por ' +
        COMPANY.contactEmail +
        '.',
    ],
  },
  {
    title: '5. O que acontece ao voltar para o Gratuito',
    paragraphs: [
      'Nada é apagado na hora. As vitrines que passam do limite do Gratuito ficam congeladas (fora do ar) e você escolhe qual continua ativa; as demais voltam assim que você assinar o Pro de novo.',
      'Na vitrine ativa, o Gratuito mostra os 10 primeiros itens e 1 vídeo, sem logo, cor da marca e banner, e com a marca d’água “Feito com Agenn Vitrine”. Os itens e as configurações continuam guardados.',
      'Os vídeos que passam do limite do Gratuito são apagados definitivamente 90 dias depois do fim do Pro. Avisamos por e-mail 7 dias antes.',
    ],
  },
  {
    title: '6. Seu conteúdo',
    paragraphs: [
      'O conteúdo que você publica é seu. Você nos concede apenas a autorização necessária para hospedar, converter e exibir esse conteúdo na sua vitrine enquanto sua conta existir.',
      'Você é o único responsável pelo que publica: preços, descrições, fotos, vídeos, disponibilidade e pelo cumprimento do que oferece. Garante também que tem os direitos sobre as imagens e vídeos que envia.',
      'Não é permitido publicar conteúdo ilegal, enganoso, que viole direitos de terceiros, nem produtos e serviços proibidos por lei ou pelas regras dos serviços que usamos, incluindo armas, drogas, medicamentos controlados, conteúdo adulto e jogos de azar.',
    ],
  },
  {
    title: '7. Uso do serviço',
    paragraphs: [
      'Cada conta tem uma franquia mensal de entrega de vídeo. Ao ultrapassá-la, os vídeos deixam de tocar e a vitrine passa a mostrar apenas as fotos até o mês virar; nada é apagado.',
      'Não é permitido tentar burlar limites do plano, acessar dados de outras contas, sobrecarregar o serviço ou usá-lo para enviar mensagens não solicitadas.',
    ],
  },
  {
    title: '8. Pedidos são entre você e seu cliente',
    paragraphs: [
      `O ${COMPANY.tradeName} monta a mensagem e abre o WhatsApp. A negociação, o pagamento, a entrega e o atendimento acontecem diretamente entre você e seu cliente: não somos parte do negócio, não processamos pagamentos de pedidos e não intermediamos entregas.`,
      'O código de pedido serve apenas para você conferir, no painel, o que foi enviado.',
    ],
  },
  {
    title: '9. Disponibilidade e suporte',
    paragraphs: [
      'Trabalhamos para manter o serviço disponível, mas ele pode ficar fora do ar por manutenção, falha de terceiros ou motivos fora do nosso controle. Não oferecemos garantia de tempo de disponibilidade.',
      `O suporte é feito por e-mail, em ${COMPANY.contactEmail}, em dias úteis.`,
    ],
  },
  {
    title: '10. Suspensão e encerramento',
    paragraphs: [
      'Podemos suspender ou encerrar contas que violem estes Termos ou a lei, de preferência após aviso, e imediatamente em casos graves.',
      'Se encerrarmos sua conta sem que você tenha dado causa, devolvemos a parte proporcional do período já pago.',
    ],
  },
  {
    title: '11. Responsabilidade',
    paragraphs: [
      'Respondemos por danos diretos comprovados, limitados ao valor pago por você nos 12 meses anteriores ao fato.',
      'Não respondemos por lucros cessantes, perda de clientes, nem por conteúdo, produtos ou serviços oferecidos por você ou por terceiros. Nada aqui afasta direitos que o Código de Defesa do Consumidor garanta a você.',
    ],
  },
  {
    title: '12. Propriedade intelectual da plataforma',
    paragraphs: [
      `A marca ${COMPANY.tradeName}, o software e o material da plataforma pertencem a ${COMPANY.legalName}. Sua assinatura dá direito de uso do serviço, não de cópia, revenda ou engenharia reversa.`,
    ],
  },
  {
    title: '13. Mudanças nestes Termos',
    paragraphs: [
      'Podemos alterar estes Termos. Mudanças relevantes são avisadas por e-mail ou no painel com pelo menos 30 dias de antecedência. Continuar usando o serviço depois disso significa concordar com a nova versão.',
    ],
  },
  {
    title: '14. Lei aplicável e foro',
    paragraphs: [
      'Estes Termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do consumidor para resolver questões que não se resolvam de forma amigável.',
    ],
  },
]
```

- [ ] **Step 8: Escrever a política de privacidade**

`src/lib/legal/privacy.ts`:

```ts
import { COMPANY } from './company'
import type { LegalSection } from './terms'

// Rascunho para revisão jurídica. Mudou aqui, mude LEGAL_VERSION em company.ts.
export const PRIVACY: LegalSection[] = [
  {
    title: '1. Quem trata seus dados',
    paragraphs: [
      `O controlador dos dados é ${COMPANY.legalName}, CNPJ ${COMPANY.cnpj}, com endereço em ${COMPANY.address}, responsável pelo serviço ${COMPANY.tradeName}.`,
      `Para falar sobre privacidade, inclusive para exercer seus direitos, escreva para ${COMPANY.privacyEmail}.`,
    ],
  },
  {
    title: '2. Quais dados tratamos',
    paragraphs: [
      'Da pessoa que cria a conta: nome, e-mail e senha (guardada apenas de forma criptografada pelo Supabase). Se você entra com o Google, recebemos nome e e-mail da sua conta Google.',
      'Do uso do serviço: vitrines, itens, fotos, vídeos, textos e configurações que você cria, além de registros técnicos como data de acesso e erros.',
      'De pagamento: a assinatura é processada pela Stripe. Guardamos apenas identificadores da assinatura e do cliente, o status, o intervalo e a data de renovação. Não guardamos número de cartão.',
      'Do visitante da vitrine: não guardamos nome, telefone, endereço nem forma de pagamento. Esses dados são digitados no navegador do visitante e seguem direto na mensagem do WhatsApp para você. O que fica salvo é o resumo do pedido (itens, quantidades e preços do momento), sem dados pessoais.',
      'Para limitar abuso, guardamos o endereço IP do visitante apenas em forma de código embaralhado (hash), que não permite voltar ao IP original, por até 2 dias.',
    ],
  },
  {
    title: '3. Por que tratamos e com qual base legal',
    paragraphs: [
      'Para criar e manter sua conta, publicar suas vitrines e cobrar a assinatura: execução do contrato (art. 7º, V, da LGPD).',
      'Para emitir documentos fiscais e guardar registros exigidos por lei: cumprimento de obrigação legal (art. 7º, II).',
      'Para segurança, prevenção a fraude e melhoria do serviço: legítimo interesse (art. 7º, IX), sempre com o menor dado possível.',
    ],
  },
  {
    title: '4. Cookies e dados guardados no aparelho',
    paragraphs: [
      'Usamos cookies necessários para manter você conectado ao painel. Não usamos cookies de publicidade.',
      'Na vitrine, a sacola do visitante fica guardada apenas no navegador dele (armazenamento local), nunca no nosso servidor, e some quando ele limpa os dados do navegador.',
    ],
  },
  {
    title: '5. Com quem compartilhamos',
    paragraphs: [
      'Usamos empresas que nos ajudam a operar o serviço, cada uma com acesso apenas ao necessário: Supabase (banco de dados e autenticação), Vercel (hospedagem do site), Bunny (armazenamento e entrega de imagens e vídeos), Stripe (pagamentos), Resend (envio de e-mails), Cloudflare (proteção contra robôs e DNS) e Google (apenas se você escolher entrar com o Google).',
      'Parte desses serviços fica fora do Brasil, então pode haver transferência internacional de dados, feita com as garantias previstas na LGPD.',
      'Não vendemos seus dados nem os de seus clientes.',
    ],
  },
  {
    title: '6. Por quanto tempo guardamos',
    paragraphs: [
      'Dados da conta e conteúdo publicado: enquanto a conta existir.',
      'Resumos de pedido do simulador: 90 dias, depois são apagados automaticamente.',
      'Vídeos que passam do limite do plano Gratuito: apagados 90 dias depois do fim do Pro, com aviso por e-mail 7 dias antes.',
      'Registros fiscais e de cobrança: pelo prazo exigido pela legislação, mesmo após a exclusão da conta.',
    ],
  },
  {
    title: '7. Excluir a conta',
    paragraphs: [
      'Você pode excluir sua conta a qualquer momento no painel, em Conta → Excluir conta. Isso cancela a assinatura, apaga suas vitrines, itens, fotos e vídeos e remove seus dados de acesso. A ação não pode ser desfeita.',
    ],
  },
  {
    title: '8. Seus direitos',
    paragraphs: [
      'A LGPD garante a você: confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão, portabilidade, informação sobre com quem compartilhamos e revisão de decisões automatizadas.',
      `Boa parte disso está no próprio painel. Para o resto, escreva para ${COMPANY.privacyEmail}; respondemos em até 15 dias.`,
    ],
  },
  {
    title: '9. Segurança',
    paragraphs: [
      'As conexões usam HTTPS, as senhas ficam criptografadas e o banco de dados tem regras que impedem uma conta de acessar os dados de outra. Nenhum sistema é totalmente imune: se acontecer um incidente relevante, avisamos você e a Autoridade Nacional de Proteção de Dados.',
    ],
  },
  {
    title: '10. Crianças e adolescentes',
    paragraphs: ['O serviço é destinado a maiores de 18 anos e não é dirigido a crianças e adolescentes.'],
  },
  {
    title: '11. Mudanças nesta política',
    paragraphs: [
      'Podemos atualizar esta política. A data da última atualização fica no topo da página e mudanças relevantes são avisadas por e-mail ou no painel.',
    ],
  },
]
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/legal`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/legal
git commit -m "feat(legal): rascunho dos termos de uso e da política de privacidade"
```

---

### Task 2: Páginas públicas, rodapé e aviso de aceite

**Files:**
- Create: `src/app/site/legal-document.tsx`, `src/app/site/termos/page.tsx`, `src/app/site/privacidade/page.tsx`, `e2e/legal.spec.ts`
- Modify: `src/app/site/page.tsx`, `src/app/app/(auth)/cadastro/sign-up-form.tsx`, `src/app/app/(painel)/painel/conta/page.tsx`

**Interfaces:**
- Consumes: `TERMS`, `PRIVACY`, `LEGAL_VERSION_LABEL` (Task 1), `buildAppUrl`/`originFor` de `@/lib/hosts/urls`
- Produces: `LegalDocument({ title, updatedAt, sections })`; rotas `/termos` e `/privacidade` no host do site

- [ ] **Step 1: Componente do documento**

`src/app/site/legal-document.tsx`:

```tsx
import Link from 'next/link'
import type { LegalSection } from '@/lib/legal/terms'

export function LegalDocument({
  title,
  updatedAt,
  sections,
}: {
  title: string
  updatedAt: string
  sections: LegalSection[]
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline">
          Agenn Vitrine
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-muted">Última atualização: {updatedAt}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-ink-muted">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
```

- [ ] **Step 2: As duas páginas**

`src/app/site/termos/page.tsx`:

```tsx
import { LEGAL_VERSION_LABEL } from '@/lib/legal/company'
import { TERMS } from '@/lib/legal/terms'
import { LegalDocument } from '../legal-document'

export const metadata = { title: 'Termos de uso' }

export default function TermosPage() {
  return <LegalDocument title="Termos de uso" updatedAt={LEGAL_VERSION_LABEL} sections={TERMS} />
}
```

`src/app/site/privacidade/page.tsx`:

```tsx
import { LEGAL_VERSION_LABEL } from '@/lib/legal/company'
import { PRIVACY } from '@/lib/legal/privacy'
import { LegalDocument } from '../legal-document'

export const metadata = { title: 'Política de privacidade' }

export default function PrivacidadePage() {
  return <LegalDocument title="Política de privacidade" updatedAt={LEGAL_VERSION_LABEL} sections={PRIVACY} />
}
```

- [ ] **Step 3: Rodapé na página inicial**

Em `src/app/site/page.tsx`, troque o `</main>` final para incluir o rodapé (o arquivo inteiro fica assim):

```tsx
import Link from 'next/link'
import { env } from '@/lib/env'
import { buildAppUrl } from '@/lib/hosts/urls'

export default function MarketingHome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-6 px-4">
      <h1 className="text-4xl font-semibold tracking-tight">Agenn Vitrine</h1>
      <p className="text-lg text-ink-muted">Catálogos e cardápios com vídeo, prontos para o WhatsApp.</p>
      <Link href={buildAppUrl('/cadastro', env.NEXT_PUBLIC_ROOT_DOMAIN)} className="underline">
        Criar minha vitrine
      </Link>
      <footer className="flex gap-4 text-sm text-ink-muted">
        <Link href="/termos" className="underline">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="underline">
          Política de privacidade
        </Link>
      </footer>
    </main>
  )
}
```

- [ ] **Step 4: Aviso de aceite no cadastro**

Em `src/app/app/(auth)/cadastro/sign-up-form.tsx`, logo abaixo de `<SubmitButton>Criar conta</SubmitButton>`:

```tsx
        <p className="text-center text-xs leading-5 text-ink-muted">
          Ao criar a conta, você concorda com os{' '}
          <a href={`${siteUrl}/termos`} target="_blank" rel="noreferrer" className="underline">
            Termos de uso
          </a>{' '}
          e a{' '}
          <a href={`${siteUrl}/privacidade`} target="_blank" rel="noreferrer" className="underline">
            Política de privacidade
          </a>
          .
        </p>
```

O componente é cliente: receba `siteUrl` por props. Em `src/app/app/(auth)/cadastro/page.tsx`, a única linha a mudar é `<SignUpForm />` → `<SignUpForm siteUrl={originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)} />`, acrescentando no topo `import { env } from '@/lib/env'` e `import { originFor } from '@/lib/hosts/urls'`. No formulário, declare `export function SignUpForm({ siteUrl }: { siteUrl: string })`.

- [ ] **Step 5: Links na tela Conta**

Em `src/app/app/(painel)/painel/conta/page.tsx`, antes do fechamento do `</div>` principal:

```tsx
      <p className="text-sm text-ink-muted">
        <a href={`${siteUrl}/termos`} className="underline">
          Termos de uso
        </a>
        {' · '}
        <a href={`${siteUrl}/privacidade`} className="underline">
          Política de privacidade
        </a>
      </p>
```

No topo do arquivo, acrescente `import { env } from '@/lib/env'`, `import { originFor } from '@/lib/hosts/urls'` e, dentro do componente, `const siteUrl = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)`.

- [ ] **Step 6: Teste de ponta a ponta**

`e2e/legal.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { SITE_URL } from '../playwright.config'

test('termos e privacidade estão publicados e ligados ao cadastro', async ({ page }) => {
  await page.goto(`${SITE_URL}/termos`)
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible()
  await expect(page.getByText('Última atualização:')).toBeVisible()
  await expect(page.getByText('renovação automática')).toBeVisible()

  await page.goto(`${SITE_URL}/privacidade`)
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible()
  await expect(page.getByText('LGPD')).toBeVisible()

  await page.goto(`${SITE_URL}/`)
  await page.getByRole('link', { name: 'Termos de uso' }).click()
  await expect(page).toHaveURL(/\/termos$/)

  await page.goto('/cadastro')
  await expect(page.getByRole('link', { name: 'Termos de uso' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Política de privacidade' })).toBeVisible()
})
```

Acrescente em `playwright.config.ts`, ao lado de `APP_URL`:

```ts
export const SITE_URL = 'http://localhost:3000'
```

- [ ] **Step 7: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add src/app/site src/app/app "e2e/legal.spec.ts" playwright.config.ts
git commit -m "feat(site): páginas de termos e privacidade, rodapé e aviso no cadastro"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge. **Avise o usuário** que `src/lib/legal/company.ts` está com "A PREENCHER" e que o texto precisa de revisão profissional antes de cobrar de verdade.

---
# Bloco 1 — Excluir conta

Branch: `fase-6/bloco-1-excluir-conta`.

Não há migração nesta fase: todas as tabelas do dono já apagam em cascata a partir de `auth.users`. O que o bloco acrescenta é um teste que **prova** isso, para que uma tabela futura sem `on delete cascade` seja pega no CI.

### Task 3: Cancelar no Stripe, apagar mídias e apagar o usuário

**Files:**
- Create: `src/features/account/delete-account.ts`, `supabase/tests/database/11_account_deletion.test.sql`
- Modify: `src/lib/billing/billing.ts`, `src/lib/billing/stripe-billing.ts`, `src/lib/billing/fake-billing.ts`, `src/features/account/actions.ts`, `src/lib/auth/auth-errors.ts`, `src/lib/auth/auth-errors.test.ts`

**Interfaces:**
- Consumes: `getBilling` (Fase 5), `removeStoredFiles`/`removeStreamVideos` de `@/lib/media/remove-media`, `storagePathList` de `@/lib/media/urls`, `requireActionUser`
- Produces:
  - `Billing.cancelSubscription(subscriptionId: string): Promise<void>`
  - `deleteAccount(userId: string): Promise<void>`
  - `deleteAccountAction(prev: FormState, formData: FormData): Promise<FormState>` (campo `confirm` = e-mail da conta)
  - `loginNotice` passa a entender `motivo=conta-excluida`

- [ ] **Step 1: Cancelamento na interface de cobrança**

Em `src/lib/billing/billing.ts`, dentro de `interface Billing`, depois de `getSubscription`:

```ts
  /** Spec 8.8: excluir a conta cancela a assinatura, mas mantém o Customer (histórico fiscal). */
  cancelSubscription(subscriptionId: string): Promise<void>
```

Em `src/lib/billing/stripe-billing.ts`, depois de `getSubscription`:

```ts
    async cancelSubscription(subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId)
      } catch (error) {
        // Já cancelada ou inexistente: o objetivo (não cobrar mais) está cumprido.
        if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return
        throw error
      }
    },
```

Em `src/lib/billing/fake-billing.ts`, depois de `getSubscription`:

```ts
    async cancelSubscription(subscriptionId) {
      const subscription = await read<BillingSubscription>(subscriptionId)
      if (!subscription) return
      await writeFakeSubscription({ ...subscription, status: 'canceled', cancelAtPeriodEnd: false })
    },
```

- [ ] **Step 2: Conferir que os dois drivers implementam o método**

Run: `npm run typecheck`
Expected: PASS. Se faltar o método em algum driver, o TypeScript aponta exatamente qual — é essa a rede de proteção aqui, já que a interface é o contrato entre os dois.

- [ ] **Step 3: A exclusão**

`src/features/account/delete-account.ts`:

```ts
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getBilling } from '@/lib/billing/billing'
import { removeStoredFiles, removeStreamVideos } from '@/lib/media/remove-media'
import { storagePathList } from '@/lib/media/urls'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { revalidateVitrine } from '@/lib/vitrines/cache'

const ALREADY_OVER = new Set(['canceled', 'incomplete_expired', 'none'])

// Spec 8.8: cancela a assinatura no Stripe e apaga dados e mídias.
// A ordem importa: se o cancelamento falhar, nada é apagado e o dono tenta de novo —
// apagar antes deixaria uma assinatura cobrando sem dono.
export async function deleteAccount(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient()

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (subscriptionError) throw subscriptionError

  if (subscription?.stripe_subscription_id && !ALREADY_OVER.has(subscription.status)) {
    await getBilling().cancelSubscription(subscription.stripe_subscription_id)
  }

  const [{ data: mediaRows, error: mediaError }, { data: vitrines, error: vitrinesError }] = await Promise.all([
    admin.from('media').select('storage_paths, bunny_video_id').eq('owner_id', userId),
    admin.from('vitrines').select('subdomain').eq('owner_id', userId),
  ])
  if (mediaError) throw mediaError
  if (vitrinesError) throw vitrinesError

  // Apagar o usuário derruba, em cascata, perfil, vitrines, itens, mídias, códigos,
  // complementos, pedidos e assinatura (conferido em 11_account_deletion.test.sql).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error

  await Promise.all([
    removeStoredFiles((mediaRows ?? []).flatMap((row) => storagePathList(row.storage_paths))),
    removeStreamVideos((mediaRows ?? []).flatMap((row) => (row.bunny_video_id ? [row.bunny_video_id] : []))),
  ])
  revalidateVitrine(...(vitrines ?? []).map((vitrine) => vitrine.subdomain))
  Sentry.captureMessage(`Conta excluída: ${userId}`)
}
```

- [ ] **Step 4: A ação**

Acrescente em `src/features/account/actions.ts` (e no topo: `import { deleteAccount } from './delete-account'` e `import * as Sentry from '@sentry/nextjs'`):

```ts
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const confirm = String(formData.get('confirm') ?? '').trim().toLowerCase()
  if (!user.email || confirm !== user.email.toLowerCase()) {
    return { fieldErrors: { confirm: 'Digite o e-mail da conta para confirmar.' } }
  }

  try {
    await deleteAccount(user.id)
  } catch (error) {
    Sentry.captureException(error)
    console.error('[conta] falha ao excluir', error)
    return { error: 'Não foi possível excluir a conta agora. Tente de novo em instantes.' }
  }

  // O usuário já não existe; só limpamos os cookies desta sessão.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  redirect('/entrar?motivo=conta-excluida')
}
```

- [ ] **Step 5: Aviso no login**

Em `src/lib/auth/auth-errors.ts`, dentro de `loginNotice`, antes do `return null`:

```ts
  if (params.motivo === 'conta-excluida') {
    return { kind: 'success', text: 'Sua conta foi excluída. Sentiremos sua falta!' }
  }
```

Acrescente em `src/lib/auth/auth-errors.test.ts`, dentro do `describe` de `loginNotice`:

```ts
  it('avisa quando a conta acabou de ser excluída', () => {
    expect(loginNotice({ motivo: 'conta-excluida' })).toEqual({
      kind: 'success',
      text: 'Sua conta foi excluída. Sentiremos sua falta!',
    })
  })
```

- [ ] **Step 6: Teste pgTAP da cascata**

`supabase/tests/database/11_account_deletion.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- Uma conta com um pouco de tudo: apagar o usuário precisa levar todo o resto junto.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000006c1', 'sai@conta.com');
insert into public.subscriptions (user_id, plan_id, status, stripe_customer_id)
  values ('00000000-0000-0000-0000-0000000006c1', 'pro', 'active', 'cus_teste_conta');

insert into public.vitrines (id, owner_id, type, subdomain, name, default_button_text) values
  ('00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-0000000006c1', 'comida', 'conta-que-sai', 'Sai', 'Pedir');
insert into public.categories (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'Geral');
insert into public.items (id, owner_id, vitrine_id, category_id, name, price_cents) values
  ('00000000-0000-0000-0000-00000000e601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-00000000c601', 'Item', 100);
insert into public.media (owner_id, vitrine_id, item_id, role, kind, status, storage_paths) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', '00000000-0000-0000-0000-00000000e601', 'cover', 'image', 'ready', '{"480":"a/b-480.webp"}'::jsonb);
insert into public.addon_groups (id, owner_id, vitrine_id, name) values
  ('00000000-0000-0000-0000-00000000a601', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'Adicionais');
insert into public.addon_options (owner_id, group_id, name, price_cents) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000a601', 'Bacon', 200);
insert into public.order_snapshots (owner_id, vitrine_id, code, payload, expires_at) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-00000000f601', 'AB23', '{}'::jsonb, now() + interval '90 days');

select is(
  (select count(*)::int from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000006c1'),
  1,
  'o código do item foi registrado pelo gatilho'
);

delete from auth.users where id = '00000000-0000-0000-0000-0000000006c1';

select is(
  (
    select
      (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.vitrines where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.categories where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.items where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.media where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.item_codes where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.addon_groups where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.addon_options where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.order_snapshots where owner_id = '00000000-0000-0000-0000-0000000006c1')
      + (select count(*) from public.checkout_settings where owner_id = '00000000-0000-0000-0000-0000000006c1')
  )::int,
  0,
  'apagar o usuário leva todos os dados dele junto'
);

select is(
  (select count(*)::int from public.plans),
  2,
  'dados compartilhados continuam de pé'
);

select * from finish();
rollback;
```

- [ ] **Step 7: Verificação e commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS. O pgTAP roda no CI (total sobe de 139 para 142).

```bash
git add src/features/account src/lib/billing src/lib/auth supabase/tests/database/11_account_deletion.test.sql
git commit -m "feat(conta): excluir conta cancela no Stripe e apaga dados e mídias"
```

---

### Task 4: Tela de excluir conta e teste de ponta a ponta

**Files:**
- Create: `src/app/app/(painel)/painel/conta/delete-account-form.tsx`, `e2e/account-delete.spec.ts`
- Modify: `src/app/app/(painel)/painel/conta/page.tsx`, `e2e/helpers.ts`

**Interfaces:**
- Consumes: `deleteAccountAction` (Task 3), `fakeSubscription`/`setSubscription` (Fase 5)
- Produces: helper `countUserRows(userId: string): Promise<number>`

- [ ] **Step 1: Formulário**

`src/app/app/(painel)/painel/conta/delete-account-form.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { deleteAccountAction } from '@/features/account/actions'
import { initialFormState } from '@/lib/forms/form-state'

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialFormState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)} className="self-start">
        Excluir conta
      </Button>
    )
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field
        label="Digite o e-mail da conta para confirmar"
        htmlFor="confirm-email"
        error={state.fieldErrors?.confirm}
        hint={email}
      >
        <Input id="confirm-email" name="confirm" autoComplete="off" invalid={Boolean(state.fieldErrors?.confirm)} />
      </Field>
      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
          Excluir minha conta
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Bloco na tela Conta**

Em `src/app/app/(painel)/painel/conta/page.tsx`, antes do parágrafo com os links legais (Task 2, Step 5), acrescente e importe `DeleteAccountForm`:

```tsx
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium leading-tight">Excluir conta</h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted">
            Cancela sua assinatura e apaga suas vitrines, itens, fotos e vídeos. Os links das suas vitrines param de
            funcionar na hora. Não dá para desfazer.
          </p>
        </div>
        <DeleteAccountForm email={user.email ?? ''} />
      </Card>
```

- [ ] **Step 3: Ajudante de teste**

Acrescente em `e2e/helpers.ts`:

```ts
// Soma as linhas do dono nas tabelas que devem cair junto com a conta.
export async function countUserRows(userId: string) {
  const admin = createAdminClient()
  const tabelas = [
    ['profiles', 'id'],
    ['subscriptions', 'user_id'],
    ['vitrines', 'owner_id'],
    ['items', 'owner_id'],
    ['media', 'owner_id'],
    ['item_codes', 'owner_id'],
  ] as const
  let total = 0
  for (const [tabela, coluna] of tabelas) {
    const { count } = await admin.from(tabela).select('*', { count: 'exact', head: true }).eq(coluna, userId)
    total += count ?? 0
  }
  return total
}
```

- [ ] **Step 4: Teste de ponta a ponta**

`e2e/account-delete.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import {
  countUserRows,
  createAdminClient,
  createConfirmedUser,
  fakeSubscription,
  seedItem,
  seedVitrine,
  setSubscription,
  signIn,
  uniqueSubdomain,
} from './helpers'

test('excluir conta cancela a assinatura, apaga tudo e tira a vitrine do ar', async ({ page, request }) => {
  const user = await createConfirmedUser('excluir')
  const customerId = `cus_fake_${crypto.randomUUID()}`
  const subscriptionId = await fakeSubscription({ customerId, userId: user.id })
  await setSubscription(user.id, { status: 'active', customerId, subscriptionId })

  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('sai') })
  await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 4990 })
  await signIn(page, user.email, user.password)

  await page.goto(`http://${vitrine.subdomain}.localhost:3000/`)
  await expect(page.getByRole('heading', { level: 1, name: vitrine.name })).toBeVisible()

  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Digite o e-mail da conta para confirmar').fill('outro@teste.com')
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page.getByText('Digite o e-mail da conta para confirmar.')).toBeVisible()

  await page.getByLabel('Digite o e-mail da conta para confirmar').fill(user.email)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/entrar\?motivo=conta-excluida$/)
  await expect(page.getByText('Sua conta foi excluída. Sentiremos sua falta!')).toBeVisible()

  expect(await countUserRows(user.id)).toBe(0)

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(user.id)
  expect(data.user).toBeNull()

  // A vitrine sai do ar (revalidação por tag).
  await expect
    .poll(async () => (await request.get(`http://${vitrine.subdomain}.localhost:3000/`)).status())
    .toBe(404)
})

test('não dá para entrar de novo com a conta excluída', async ({ page }) => {
  const user = await createConfirmedUser('excluir-login')
  await signIn(page, user.email, user.password)
  await page.goto('/painel/conta')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Digite o e-mail da conta para confirmar').fill(user.email)
  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/entrar\?motivo=conta-excluida$/)

  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})
```

Observação: o segundo teste depende da mensagem de credencial inválida já usada no projeto (`AUTH_ERROR_MESSAGES['invalid_credentials']`). Se o texto for outro, use o que estiver em `src/lib/auth/auth-errors.ts`.

- [ ] **Step 5: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake npx playwright test e2e/account-delete.spec.ts --project=desktop
git add src/app/app "src/features/account" e2e/helpers.ts e2e/account-delete.spec.ts
git commit -m "feat(conta): tela de excluir conta com confirmação por e-mail"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---
# Bloco 2 — QR Code da vitrine

Branch: `fase-6/bloco-2-qr-code`.

### Task 5: QR Code gerado no navegador

**Files:**
- Create: `src/app/app/(painel)/painel/qr-code-button.tsx`, `e2e/qr-code.spec.ts`
- Modify: `package.json`, `src/app/app/(painel)/painel/page.tsx`

**Interfaces:**
- Consumes: `buildVitrineUrl` (já usado no card), `Button` de `@/components/ui/button`
- Produces: `QrCodeButton({ url, name, subdomain }: { url: string; name: string; subdomain: string })`

- [ ] **Step 1: Dependência**

```bash
npm install qrcode@^1.5.4
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Componente**

`src/app/app/(painel)/painel/qr-code-button.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function QrCodeButton({ url, name, subdomain }: { url: string; name: string; subdomain: string }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)

  // A biblioteca só é baixada quando alguém abre o QR Code.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setFailed(false)
    void (async () => {
      try {
        const { toCanvas } = await import('qrcode')
        if (cancelled || !canvas.current) return
        await toCanvas(canvas.current, url, { width: 320, margin: 2 })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, url])

  function download() {
    if (!canvas.current) return
    const link = document.createElement('a')
    link.href = canvas.current.toDataURL('image/png')
    link.download = `qrcode-${subdomain}.png`
    link.click()
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        QR Code
      </Button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={`QR Code de ${name}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-control bg-surface p-6 text-center">
        <h2 className="text-lg font-medium">{name}</h2>
        {failed ? (
          <p className="text-sm text-danger">Não foi possível gerar o QR Code. Tente de novo.</p>
        ) : (
          <canvas ref={canvas} aria-label={`QR Code de ${name}`} role="img" className="size-[320px] max-w-full" />
        )}
        <p className="break-all text-sm text-ink-muted">{url.replace(/^https?:\/\//, '')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={download} disabled={failed}>
            Baixar PNG
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Botão no card da vitrine (spec 8.2)**

Em `src/app/app/(painel)/painel/page.tsx`, importe `QrCodeButton` e acrescente dentro da `<div className="flex flex-wrap gap-2">`, entre `<CopyLinkButton />` e o `Link` de Editar:

```tsx
                    <QrCodeButton url={url} name={vitrine.name} subdomain={vitrine.subdomain} />
```

- [ ] **Step 4: Teste de ponta a ponta**

`e2e/qr-code.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createConfirmedUser, seedVitrine, signIn, uniqueSubdomain } from './helpers'

test('QR Code da vitrine abre, mostra o endereço e pode ser baixado', async ({ page }) => {
  const user = await createConfirmedUser('qr')
  const vitrine = await seedVitrine(user.id, { name: 'Loja do QR', subdomain: uniqueSubdomain('qr') })
  await signIn(page, user.email, user.password)

  await page.getByRole('button', { name: 'QR Code' }).click()
  const dialog = page.getByRole('dialog', { name: 'QR Code de Loja do QR' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(`${vitrine.subdomain}.localhost:3000`)).toBeVisible()
  await expect(dialog.getByRole('img', { name: 'QR Code de Loja do QR' })).toBeVisible()

  // O canvas precisa ter conteúdo, não só existir.
  const pixels = await dialog.getByRole('img', { name: 'QR Code de Loja do QR' }).evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return new Set(data).size
  })
  expect(pixels).toBeGreaterThan(1)

  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Baixar PNG' }).click()
  expect((await download).suggestedFilename()).toBe(`qrcode-${vitrine.subdomain}.png`)

  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toBeHidden()
})
```

- [ ] **Step 5: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake npx playwright test e2e/qr-code.spec.ts --project=desktop
git add package.json package-lock.json "src/app/app/(painel)/painel" e2e/qr-code.spec.ts
git commit -m "feat(painel): QR Code da vitrine gerado no navegador"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---

# Bloco 3 — robots.txt, sitemap.xml e prévias da Vercel

Branch: `fase-6/bloco-3-indexacao`.

Fecha duas pendências antigas: nenhuma vitrine tem `robots.txt`/`sitemap.xml` (e o matcher do proxy ignorava `.txt`/`.xml`) e as prévias da Vercel não eram roteadas.

### Task 6: Hosts — prévias da Vercel e matcher do proxy

**Files:**
- Modify: `src/lib/hosts/parse-host.ts`, `src/lib/hosts/parse-host.test.ts`, `src/proxy.ts`

**Interfaces:**
- Produces: `parseHost` resolve `*.vercel.app` como `{ type: 'app' }`; o matcher do proxy deixa passar `.txt` e `.xml`

- [ ] **Step 1: Teste que falha**

Acrescente em `src/lib/hosts/parse-host.test.ts`:

```ts
  it('prévia da Vercel vale como painel', () => {
    expect(parseHost('agenn-vitrine-v1-git-fase-6.vercel.app', config)).toEqual({ type: 'app' })
    expect(parseHost('agenn-vitrine-v1.vercel.app', config)).toEqual({ type: 'app' })
  })

  it('não confunde um domínio que só termina parecido', () => {
    expect(parseHost('vercel.app.golpe.com', config)).toEqual({ type: 'invalid' })
  })
```

Use o mesmo objeto `config` dos testes vizinhos (rootDomain e legacyDomains).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/hosts/parse-host.test.ts`
Expected: FAIL — hoje `*.vercel.app` devolve `{ type: 'invalid' }`.

- [ ] **Step 3: Implementar**

Em `src/lib/hosts/parse-host.ts`, logo antes de `if (host === root || host === \`www.${root}\`)`:

```ts
  // Prévias da Vercel não têm subdomínio de vitrine: servem para testar o painel.
  const withoutPort = host.split(':')[0]
  if (withoutPort === 'vercel.app' || withoutPort.endsWith('.vercel.app')) return { type: 'app' }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/hosts/parse-host.test.ts`
Expected: PASS.

- [ ] **Step 5: Matcher do proxy**

Em `src/proxy.ts`, troque o `config` do fim do arquivo:

```ts
// `.txt` e `.xml` passam pelo proxy de propósito: robots.txt e sitemap.xml são
// rotas por host (vitrine, site e painel têm conteúdos diferentes).
export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
```

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/hosts src/proxy.ts
git commit -m "feat(hosts): prévias da Vercel viram painel e o proxy deixa passar .txt e .xml"
```

---

### Task 7: robots.txt e sitemap.xml por host

**Files:**
- Create: `src/lib/public/robots.ts`, `src/lib/public/robots.test.ts`, `src/lib/public/sitemap.ts`, `src/lib/public/sitemap.test.ts`, `src/app/v/[subdomain]/robots.txt/route.ts`, `src/app/v/[subdomain]/sitemap.xml/route.ts`, `src/app/site/robots.txt/route.ts`, `src/app/site/sitemap.xml/route.ts`, `src/app/app/robots.txt/route.ts`, `e2e/robots-sitemap.spec.ts`

**Interfaces:**
- Consumes: `loadPublicVitrine` de `@/features/public/load-vitrine`, `buildVitrineUrl`/`originFor` de `@/lib/hosts/urls`
- Produces:
  - `robotsTxt({ allow, sitemapUrl }: { allow: boolean; sitemapUrl?: string }): string`
  - `sitemapXml(entries: { loc: string; lastmod?: string }[]): string`

- [ ] **Step 1: Testes que falham**

`src/lib/public/robots.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { robotsTxt } from './robots'

describe('robotsTxt', () => {
  it('libera e aponta o sitemap', () => {
    expect(robotsTxt({ allow: true, sitemapUrl: 'https://loja.agenn.com.br/sitemap.xml' })).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://loja.agenn.com.br/sitemap.xml\n',
    )
  })

  it('bloqueia tudo quando não há o que indexar', () => {
    expect(robotsTxt({ allow: false })).toBe('User-agent: *\nDisallow: /\n')
  })
})
```

`src/lib/public/sitemap.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sitemapXml } from './sitemap'

describe('sitemapXml', () => {
  it('monta o XML com as URLs', () => {
    const xml = sitemapXml([
      { loc: 'https://loja.agenn.com.br/', lastmod: '2026-09-18' },
      { loc: 'https://loja.agenn.com.br/?item=101' },
    ])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<loc>https://loja.agenn.com.br/</loc>')
    expect(xml).toContain('<lastmod>2026-09-18</lastmod>')
    expect(xml).toContain('<loc>https://loja.agenn.com.br/?item=101</loc>')
  })

  it('escapa o que o XML não aceita cru', () => {
    expect(sitemapXml([{ loc: 'https://x.com/?a=1&b=2' }])).toContain('?a=1&amp;b=2')
  })

  it('aceita lista vazia', () => {
    expect(sitemapXml([])).toContain('<urlset')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/public`
Expected: FAIL — os módulos não existem.

- [ ] **Step 3: Implementar as funções puras**

`src/lib/public/robots.ts`:

```ts
export function robotsTxt(input: { allow: boolean; sitemapUrl?: string }): string {
  const lines = ['User-agent: *', input.allow ? 'Allow: /' : 'Disallow: /']
  if (input.allow && input.sitemapUrl) lines.push('', `Sitemap: ${input.sitemapUrl}`)
  return `${lines.join('\n')}\n`
}
```

`src/lib/public/sitemap.ts`:

```ts
export type SitemapEntry = { loc: string; lastmod?: string }

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/public`
Expected: PASS.

- [ ] **Step 5: Rotas da vitrine**

`src/app/v/[subdomain]/robots.txt/route.ts`:

```ts
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { robotsTxt } from '@/lib/public/robots'

const TEXT = { headers: { 'content-type': 'text/plain; charset=utf-8' } }

// Vitrine congelada ou inexistente não deve ser indexada (spec 7.1).
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine || vitrine.status !== 'active') return new Response(robotsTxt({ allow: false }), TEXT)

  const base = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
  return new Response(robotsTxt({ allow: true, sitemapUrl: `${base}/sitemap.xml` }), TEXT)
}
```

`src/app/v/[subdomain]/sitemap.xml/route.ts`:

```ts
import { loadPublicVitrine } from '@/features/public/load-vitrine'
import { env } from '@/lib/env'
import { buildVitrineUrl } from '@/lib/hosts/urls'
import { sitemapXml } from '@/lib/public/sitemap'

// Cada item tem link próprio pela query `?item={código}` (spec 7.3).
export async function GET(_request: Request, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const vitrine = await loadPublicVitrine(subdomain)
  if (!vitrine || vitrine.status !== 'active') return new Response(null, { status: 404 })

  const base = buildVitrineUrl(vitrine.subdomain, env.NEXT_PUBLIC_ROOT_DOMAIN)
  const items = vitrine.categories.flatMap((category) => category.items)
  const xml = sitemapXml([
    { loc: `${base}/` },
    ...items.map((item) => ({ loc: `${base}/?item=${item.code}` })),
  ])
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
```

- [ ] **Step 6: Rotas do site e do painel**

`src/app/site/robots.txt/route.ts`:

```ts
import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { robotsTxt } from '@/lib/public/robots'

export async function GET() {
  const base = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)
  return new Response(robotsTxt({ allow: true, sitemapUrl: `${base}/sitemap.xml` }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
```

`src/app/site/sitemap.xml/route.ts`:

```ts
import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { sitemapXml } from '@/lib/public/sitemap'

export async function GET() {
  const base = originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)
  const xml = sitemapXml([{ loc: `${base}/` }, { loc: `${base}/termos` }, { loc: `${base}/privacidade` }])
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
```

`src/app/app/robots.txt/route.ts`:

```ts
import { robotsTxt } from '@/lib/public/robots'

// O painel e as telas de acesso nunca são indexados.
export async function GET() {
  return new Response(robotsTxt({ allow: false }), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
```

- [ ] **Step 7: Teste de ponta a ponta**

`e2e/robots-sitemap.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { APP_URL, SITE_URL } from '../playwright.config'
import { createAdminClient, createConfirmedUser, seedItem, seedVitrine, uniqueSubdomain } from './helpers'

test('cada host tem seu robots.txt e a vitrine tem sitemap', async ({ request }) => {
  const user = await createConfirmedUser('robots')
  const vitrine = await seedVitrine(user.id, { subdomain: uniqueSubdomain('rb') })
  const item = await seedItem(vitrine, user.id, { name: 'Camiseta', priceCents: 4990 })
  const base = `http://${vitrine.subdomain}.localhost:3000`

  const painel = await request.get(`${APP_URL}/robots.txt`)
  expect(painel.status()).toBe(200)
  expect(await painel.text()).toContain('Disallow: /')

  const site = await request.get(`${SITE_URL}/robots.txt`)
  expect(await site.text()).toContain('Allow: /')
  expect(await (await request.get(`${SITE_URL}/sitemap.xml`)).text()).toContain('/termos')

  const robots = await request.get(`${base}/robots.txt`)
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain(`Sitemap: ${base}/sitemap.xml`)

  const sitemap = await request.get(`${base}/sitemap.xml`)
  expect(sitemap.headers()['content-type']).toContain('application/xml')
  const xml = await sitemap.text()
  expect(xml).toContain(`<loc>${base}/</loc>`)
  expect(xml).toContain(`?item=${item.code}`)

  // Congelada some dos buscadores. Uma vitrine nova, já congelada, nunca foi gerada
  // antes: o primeiro acesso já mostra o estado certo, sem depender de revalidação.
  const congelada = await seedVitrine(user.id, { subdomain: uniqueSubdomain('rb-frozen') })
  await createAdminClient().from('vitrines').update({ status: 'frozen' }).eq('id', congelada.id).throwOnError()
  const baseCongelada = `http://${congelada.subdomain}.localhost:3000`
  expect(await (await request.get(`${baseCongelada}/robots.txt`)).text()).toContain('Disallow: /')
  expect((await request.get(`${baseCongelada}/sitemap.xml`)).status()).toBe(404)
})
```

Observações:
- A segunda vitrine só é permitida com a conta no Pro (trava do banco). Antes de semeá-la, chame
  `await setSubscription(user.id, { status: 'active' })` e acrescente `setSubscription` aos imports.
- `loadPublicVitrine` é cacheado por tag: escrever direto no banco **não** revalida. Por isso o teste
  usa uma vitrine nova em vez de congelar a que já foi acessada.

- [ ] **Step 8: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake npx playwright test e2e/robots-sitemap.spec.ts --project=desktop
git add src/lib/public src/app/v src/app/site src/app/app e2e/robots-sitemap.spec.ts
git commit -m "feat(seo): robots.txt e sitemap.xml por host"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge.

---
# Bloco 4 — Checagens de disponibilidade fora das Server Actions

Branch: `fase-6/bloco-4-disponibilidade`.

Hoje as checagens de subdomínio e de código de item são Server Actions com debounce. Quando a pessoa navega no meio da espera, a ação é enviada para uma rota que não a conhece e o log enche de "Failed to find Server Action" (inofensivo para quem usa, ruído no Sentry). Viram rotas GET com `AbortController`.

### Task 8: Rotas de disponibilidade e clientes com AbortController

**Files:**
- Create: `src/lib/forms/availability.ts`, `src/lib/forms/availability.test.ts`, `src/app/api/disponibilidade/subdominio/route.ts`, `src/app/api/disponibilidade/codigo/route.ts`
- Modify: `src/lib/vitrines/schemas.ts`, `src/features/vitrines/actions.ts`, `src/features/items/actions.ts`, `src/app/app/(painel)/painel/vitrines/nova/wizard.tsx`, `src/app/app/(painel)/painel/vitrines/[id]/configuracoes/settings-form.tsx`, `src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx`

**Interfaces:**
- Produces:
  - `SUBDOMAIN_TAKEN_MESSAGE` em `@/lib/vitrines/schemas`
  - `type Availability = { ok: boolean; message: string }` e `fetchAvailability(url: string, signal: AbortSignal): Promise<Availability | null>` (nulo = cancelada)
  - `GET /api/disponibilidade/subdominio?valor=&vitrine=` e `GET /api/disponibilidade/codigo?valor=&item=`, ambas exigindo sessão
- Removes: `checkSubdomainAction`, `checkItemCodeAction`

- [ ] **Step 1: Teste que falha para o cliente**

`src/lib/forms/availability.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAvailability } from './availability'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAvailability', () => {
  it('devolve o que a rota respondeu', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true, message: 'Endereço disponível.' })))
    const controller = new AbortController()
    expect(await fetchAvailability('/api/disponibilidade/subdominio?valor=loja', controller.signal)).toEqual({
      ok: true,
      message: 'Endereço disponível.',
    })
  })

  it('erro de rede vira mensagem em português', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('sem rede')
    })
    const controller = new AbortController()
    expect(await fetchAvailability('/x', controller.signal)).toEqual({
      ok: false,
      message: 'Não foi possível verificar agora.',
    })
  })

  it('resposta de erro do servidor também', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    expect(await fetchAvailability('/x', new AbortController().signal)).toEqual({
      ok: false,
      message: 'Não foi possível verificar agora.',
    })
  })

  it('checagem cancelada devolve nulo, sem mensagem', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new DOMException('cancelada', 'AbortError')
    })
    const controller = new AbortController()
    controller.abort()
    expect(await fetchAvailability('/x', controller.signal)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/forms/availability.test.ts`
Expected: FAIL — `./availability` não existe.

- [ ] **Step 3: Implementar o cliente**

`src/lib/forms/availability.ts`:

```ts
export type Availability = { ok: boolean; message: string }

const GENERIC = 'Não foi possível verificar agora.'

// Devolve `null` quando a checagem foi cancelada (a pessoa continuou digitando
// ou saiu da página): nesse caso não há nada para mostrar.
export async function fetchAvailability(url: string, signal: AbortSignal): Promise<Availability | null> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return { ok: false, message: GENERIC }
    return (await response.json()) as Availability
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    return { ok: false, message: GENERIC }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/forms/availability.test.ts`
Expected: PASS.

- [ ] **Step 5: Mensagem compartilhada**

Em `src/lib/vitrines/schemas.ts`, acrescente:

```ts
export const SUBDOMAIN_TAKEN_MESSAGE = 'Este endereço já está em uso. Escolha outro.'
```

Em `src/features/vitrines/actions.ts`, apague `const SUBDOMAIN_TAKEN = ...` e importe a constante nova, trocando os usos de `SUBDOMAIN_TAKEN` por `SUBDOMAIN_TAKEN_MESSAGE`.

- [ ] **Step 6: Rotas**

`src/app/api/disponibilidade/subdominio/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SUBDOMAIN_TAKEN_MESSAGE, subdomainField } from '@/lib/vitrines/schemas'

// Checagem enquanto o dono digita (spec 5.1 e 8.3). Era Server Action; virou rota
// para poder ser cancelada e não sujar o log quando a página muda.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = subdomainField.safeParse(url.searchParams.get('valor') ?? '')
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Sessão expirada. Entre de novo.' }, { status: 401 })

  const { data, error } = await supabase.rpc('is_subdomain_available', {
    p_subdomain: parsed.data,
    p_except_vitrine_id: url.searchParams.get('vitrine') ?? undefined,
  })
  if (error) return NextResponse.json({ ok: false, message: 'Não foi possível verificar agora.' })

  return NextResponse.json(
    data ? { ok: true, message: 'Endereço disponível.' } : { ok: false, message: SUBDOMAIN_TAKEN_MESSAGE },
  )
}
```

`src/app/api/disponibilidade/codigo/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { ITEM_CODE_MESSAGES, validateItemCode } from '@/lib/codes/item-code'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = validateItemCode(url.searchParams.get('valor') ?? '')
  if (!result.ok) return NextResponse.json({ ok: false, message: ITEM_CODE_MESSAGES[result.reason] })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Sessão expirada. Entre de novo.' }, { status: 401 })

  const { data, error } = await supabase.rpc('is_item_code_available', {
    p_code: result.value,
    p_item_id: url.searchParams.get('item') ?? undefined,
  })
  if (error) return NextResponse.json({ ok: false, message: 'Não foi possível verificar agora.' })

  return NextResponse.json(
    data ? { ok: true, message: 'Código disponível.' } : { ok: false, message: ITEM_CODE_MESSAGES.taken },
  )
}
```

- [ ] **Step 7: Assistente de nova vitrine**

Em `src/app/app/(painel)/painel/vitrines/nova/wizard.tsx`: troque o import de `checkSubdomainAction` por `createVitrineAction` apenas, acrescente `import { fetchAvailability } from '@/lib/forms/availability'` e substitua o bloco do timer por:

```tsx
  const [availability, setAvailability] = useState<{ ok: boolean; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef<AbortController>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inFlight.current?.abort()
    },
    [],
  )
  function onSubdomainChange(value: string) {
    setAvailability(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    if (!value.trim()) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const result = await fetchAvailability(
        `/api/disponibilidade/subdominio?valor=${encodeURIComponent(value)}`,
        controller.signal,
      )
      if (result) setAvailability(result)
    }, 400)
  }
```

- [ ] **Step 8: Configurações da vitrine**

Em `src/app/app/(painel)/painel/vitrines/[id]/configuracoes/settings-form.tsx`, mesmo tratamento, mantendo a regra de não checar o subdomínio já salvo:

```tsx
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inFlight = useRef<AbortController>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inFlight.current?.abort()
    },
    [],
  )
  function onSubdomainChange(value: string) {
    setTypedSubdomain(value)
    setAvailability(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    if (!value.trim() || value.trim().toLowerCase() === savedSubdomain) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const result = await fetchAvailability(
        `/api/disponibilidade/subdominio?valor=${encodeURIComponent(value)}&vitrine=${vitrineId}`,
        controller.signal,
      )
      if (result) setAvailability(result)
    }, 400)
  }
```

Troque também o import de `checkSubdomainAction` por `fetchAvailability`.

- [ ] **Step 9: Formulário do item**

Em `src/app/app/(painel)/painel/vitrines/[id]/itens/item-form.tsx`, troque o import de `checkItemCodeAction` por `fetchAvailability` e o bloco por:

```tsx
  function onCodeChange(raw: string) {
    setCodeEdited(true)
    setCodeCheck(null)
    clearTimeout(timer.current)
    inFlight.current?.abort()
    const value = normalizeItemCode(raw)
    if (!value || value === item?.code) return
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      inFlight.current = controller
      const query = item?.id ? `&item=${item.id}` : ''
      const result = await fetchAvailability(
        `/api/disponibilidade/codigo?valor=${encodeURIComponent(value)}${query}`,
        controller.signal,
      )
      if (result) setCodeCheck(result)
    }, 400)
  }
```

Declare `const inFlight = useRef<AbortController>(undefined)` junto do `timer` e cancele os dois no `useEffect` de limpeza que já existe.

- [ ] **Step 10: Apagar as ações antigas**

Apague `checkSubdomainAction` de `src/features/vitrines/actions.ts` e `checkItemCodeAction` de `src/features/items/actions.ts`, junto dos imports que ficarem sem uso (`validateItemCode`/`ITEM_CODE_MESSAGES` podem continuar sendo usados por outras funções — confira antes).

Run: `npm run lint && npm run typecheck`
Expected: PASS. Se sobrar import sem uso, o lint aponta.

- [ ] **Step 11: Testes já existentes cobrem a interface**

Os e2e de `vitrines.spec.ts`, `editor.spec.ts` e `items.spec.ts` já verificam as mensagens "Endereço disponível.", "Este endereço já está em uso. Escolha outro." e "Código disponível." — eles precisam continuar verdes com as rotas novas. Acrescente em `e2e/vitrines.spec.ts` um teste da rota sem sessão:

```ts
test('checagem de disponibilidade exige sessão', async ({ request }) => {
  const response = await request.get(`${APP_URL}/api/disponibilidade/subdominio?valor=qualquer`)
  expect(response.status()).toBe(401)
  expect((await response.json()).ok).toBe(false)
})
```

Se `APP_URL` ainda não for importado no arquivo, acrescente `import { APP_URL } from '../playwright.config'`.

- [ ] **Step 12: Verificação e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
CI=1 BILLING_DRIVER=fake STRIPE_WEBHOOK_SECRET=whsec-local-somente-para-testes MEDIA_STORAGE_DRIVER=fake VIDEO_STREAM_DRIVER=fake RATE_LIMIT_SALT=local-salt-para-testes-1234 CRON_SECRET=local-cron-secret-para-testes EMAIL_DRIVER=fake npx playwright test e2e/vitrines.spec.ts e2e/items.spec.ts --project=desktop
git add src/lib/forms src/lib/vitrines/schemas.ts src/features src/app/api/disponibilidade "src/app/app/(painel)" e2e/vitrines.spec.ts
git commit -m "refactor(painel): checagens de disponibilidade viram rotas GET canceláveis"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

**Depois do merge:** confira no log do próximo CI que "Failed to find Server Action" não aparece mais. Se aparecer, sobrou alguma Server Action com debounce.

---

# Bloco 5 — Fechamento

Branch: `fase-6/bloco-5-fechamento`.

### Task 9: Conferência em produção e pendências

**Files:**
- Create: `docs/setup/fase-6-conferencia.md`
- Modify: `docs/setup/fase-5-infra.md`

- [ ] **Step 1: Documento de conferência**

`docs/setup/fase-6-conferencia.md`:

```markdown
# Fase 6 — Conferência em produção

Sem variáveis novas e sem passo de infraestrutura. O que muda em produção: páginas legais,
excluir conta, QR Code, `robots.txt`/`sitemap.xml` e as checagens de disponibilidade.

## Antes de tudo: preencher os dados da empresa

`src/lib/legal/company.ts` está com "A PREENCHER" na razão social, no CNPJ e no endereço.
Enquanto estiver assim, os textos legais **não estão prontos** para o lançamento. Preencha,
mude `LEGAL_VERSION` para a data da publicação e mande revisar por um profissional — o texto
entregue aqui é um rascunho, não um parecer jurídico.

1. **Páginas legais:** `agenn.com.br/termos` e `agenn.com.br/privacidade` abrem, mostram
   "Última atualização" e não têm "A PREENCHER". Os links aparecem no rodapé da página
   inicial, abaixo do botão do cadastro e na tela Conta.
2. **QR Code:** no painel, "QR Code" abre o código da vitrine, o endereço mostrado é o da
   vitrine e "Baixar PNG" salva o arquivo. Ler o QR com o celular precisa abrir a vitrine.
3. **Excluir conta (use uma conta de teste):** a confirmação exige o e-mail certo; depois da
   exclusão, a vitrine sai do ar, o login não funciona mais e, no Stripe, a assinatura aparece
   como cancelada e o Customer continua lá (histórico fiscal).
4. **robots.txt:** `app.agenn.com.br/robots.txt` traz `Disallow: /`;
   `agenn.com.br/robots.txt` traz `Allow: /` e o link do sitemap;
   `{vitrine}.agenn.com.br/robots.txt` traz o sitemap da vitrine.
5. **sitemap.xml:** `{vitrine}.agenn.com.br/sitemap.xml` lista a vitrine e um `?item=CÓDIGO`
   por item. Numa vitrine congelada, responde 404.
6. **Disponibilidade:** no assistente e nas configurações, digitar um endereço já usado mostra
   "Este endereço já está em uso"; digitar rápido e sair da página não deve gerar
   "Failed to find Server Action" nos logs da Vercel.
7. **Prévia da Vercel:** abrir a URL `*.vercel.app` de um PR leva ao painel (antes dava
   "host inválido").

## Pendências registradas

- Desempenho e Lighthouse ≥ 90 (spec 7.6 e 11) ficaram para a fase de design.
- Migração de domínio (spec 2.2) continua pendente e tem roteiro próprio na spec; os QR Codes
  já gerados seguem funcionando pelo redirecionamento 301.
- Consentimento de termos dentro do Checkout do Stripe (`consent_collection`) não está ligado;
  o aceite acontece no cadastro.
- Bunny Stream travado em "Processing" continua aberto (ticket do fornecedor).
```

- [ ] **Step 2: Nota no guia da Fase 5**

Em `docs/setup/fase-5-infra.md`, na seção 4 (Customer Portal), acrescente:

```markdown
- Opcional, depois que as páginas legais estiverem publicadas: apontar os links de Termos de
  uso (`https://agenn.com.br/termos`) e Política de privacidade (`https://agenn.com.br/privacidade`)
  nas configurações públicas da conta Stripe, para aparecerem no Checkout.
```

- [ ] **Step 3: Conferência final e PR**

```bash
npm run lint && npm run typecheck && npm test && npm run build
git add docs/setup/fase-6-conferencia.md docs/setup/fase-5-infra.md
git commit -m "docs: conferência da Fase 6"
git push -u origin HEAD
gh pr create --fill --base master
gh pr checks --watch
```

Autorização → merge → conferência com o usuário → memória `fase-6-pendencias`.

---

## Cobertura da spec nesta fase

| Spec | Onde |
|---|---|
| 2.1 — cada host com seu conteúdo (agora inclusive robots/sitemap) | Tasks 6, 7 |
| 2.2 — nenhum domínio fixo no código (QR Code e sitemap saem de `ROOT_DOMAIN`) | Tasks 5, 7 |
| 5.1 — checagem do código do item enquanto digita | Task 8 |
| 8.1 — cadastro com aviso de aceite dos termos | Task 2 |
| 8.2 — QR Code no card da vitrine | Task 5 |
| 8.3 — disponibilidade do subdomínio no assistente | Task 8 |
| 8.8 — excluir conta: cancela no Stripe e apaga dados e mídias | Tasks 3, 4 |
| 11 — unitários (textos, robots, sitemap, disponibilidade) e e2e (legal, exclusão, QR, indexação) | Tasks 1, 4, 5, 7, 8 |
| 12 — Fase 6: QR Code, excluir conta, termos e política | Todas |
| 7.6 e 11 (desempenho, Lighthouse ≥ 90) | **Adiado para a fase de design**, por decisão do usuário |

## Fora desta fase

- **Desempenho e Lighthouse CI:** fase de design.
- **Migração de domínio (spec 2.2):** operação própria, com roteiro na spec.
- **Pix, boleto, cupons e planos adicionais** (spec 13): fora do escopo do produto.

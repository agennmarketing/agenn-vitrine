# Fase 5 — Infraestrutura (Stripe)

O produto "Pro" e os dois preços em BRL (mensal e anual) já existem na conta. Falta ligar o
resto. Faça tudo primeiro em **modo de teste** (nos painéis novos, *sandbox*) e repita em
**modo ao vivo** antes do lançamento — chaves, ids de preço e segredo do webhook são
diferentes nos dois modos, e um id de preço de teste não existe em produção.

**Estado atual:** modo de teste configurado e as quatro variáveis salvas na Vercel
(2026-09-17). O modo ao vivo entra na virada, seguindo a seção 7.

## 1. Ids dos preços

Painel do Stripe → Catálogo de produtos → Pro → copie os dois ids que começam com `price_`:
um do plano mensal (R$ 149,90) e um do anual (R$ 1.499,00). Confirme que os dois estão em BRL
e são recorrentes. Se o produto só existir em um dos modos, crie o equivalente no outro.

## 2. Webhook

Painel → Desenvolvedores → Webhooks → Adicionar destino:

- URL: `https://app.agenn.com.br/api/webhooks/stripe`
- Destino: eventos da própria conta (não "Contas Conectadas")
- Versão da API: a **mais recente** da lista (nunca anterior a `2025-03-31.basil`, que foi
  quando o id da assinatura passou para `invoice.parent.subscription_details.subscription`;
  a rota aceita os dois formatos, mas o novo é o esperado)
- Eventos (exatamente estes seis, sem "Selecionar tudo"):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Depois de criar, copie o **segredo de assinatura** (`whsec_...`).

Crie o destino do modo ao vivo só na virada: com as chaves de teste no ar, eventos ao vivo
nessa URL falhariam na verificação de assinatura (401) e o Stripe acabaria desativando o
destino por excesso de falhas.

## 3. Retentativas e cancelamento (spec 9)

Painel → Configurações → Faturamento → Assinaturas e e-mails → pagamentos malsucedidos:

- Tentar de novo por **7 dias**
- Ao fim das tentativas: **cancelar a assinatura**

É a mesma janela da carência (`grace_until`) gravada pelo sistema.

## 4. Customer Portal

Painel → Configurações → Faturamento → Portal do cliente:

- Ligar: cancelar assinatura **no fim do período pago**, atualizar forma de pagamento, ver faturas
- Ligar a troca entre os preços mensal e anual do produto Pro
- Desligar: alterar quantidade
- URL de retorno padrão: `https://app.agenn.com.br/painel/plano`

- Opcional, depois que as páginas legais estiverem publicadas: apontar os links de Termos de
  uso (`https://agenn.com.br/termos`) e Política de privacidade (`https://agenn.com.br/privacidade`)
  nas configurações públicas da conta Stripe, para aparecerem no Checkout.

## 5. Variáveis na Vercel (`agenn-vitrine-v1`)

| Key | Value | Type | Ambientes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` / `sk_live_...` | Secret | Production e Preview |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` do destino criado na seção 2 | Secret | Production e Preview |
| `STRIPE_PRICE_MONTH` | `price_...` do mensal | Config | Production e Preview |
| `STRIPE_PRICE_YEAR` | `price_...` do anual | Config | Production e Preview |

`BILLING_DRIVER` não precisa ser criada: sem ela o padrão já é `stripe`. O valor `fake` é
recusado pelo próprio código quando `VERCEL_ENV=production`. Depois de salvar, faça um
**Redeploy** — variável só vale no próximo deploy.

Faltando qualquer uma delas, nada quebra: o webhook responde 503, a tela do plano aparece sem
os preços e o botão de assinar mostra um erro em português.

## 6. Conferência com a Stripe CLI (modo de teste)

Opcional, para ver os eventos localmente com as variáveis de teste num `.env.local`:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

Cada evento deve responder 200 e mudar a linha do dono em `subscriptions`. Um evento repetido
responde `{"duplicated":true}`.

## 7. Virada para o modo ao vivo

1. Ligar o modo de produção no painel do Stripe.
2. Conferir produto e preços (seção 1) e criar o destino de webhook ao vivo (seção 2).
3. Repetir as configurações de retentativas (seção 3) e do portal (seção 4): elas são por modo.
4. Cancelar no Stripe as assinaturas de teste que existirem e limpar as linhas
   correspondentes em `subscriptions` — um `stripe_subscription_id` de teste não é encontrado
   no modo ao vivo, e a conferência diária ignoraria essa linha para sempre.
5. Editar as quatro variáveis de **Production** na Vercel com os valores ao vivo e fazer
   Redeploy. Deixar **Preview** com os valores de teste.
6. Rodar `docs/setup/fase-5-conferencia.md` com uma assinatura real e cancelá-la depois.

## 8. Pendências registradas

- Excluir conta (cancelar a assinatura no Stripe e apagar dados e mídias) fica na Fase 6.
- Pix e boleto continuam fora do escopo (spec 13): só cartão.
- Cupons e promoções não estão ligados no checkout.
- Sem Stripe CLI no CI: o CI usa o driver falso e a integração real é conferida à mão.

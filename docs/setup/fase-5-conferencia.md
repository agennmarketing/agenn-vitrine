# Fase 5 — Conferência em produção

Antes de começar: `docs/setup/fase-5-infra.md` feito (webhook, portal, retentativas e
variáveis na Vercel). Faça o roteiro primeiro em **modo de teste**, com o cartão
`4242 4242 4242 4242` (qualquer validade futura e CVC), e repita o essencial em modo ao vivo
depois da virada (§7 do guia de infraestrutura).

1. **Tela do plano:** `app.agenn.com.br/painel/plano` mostra "Plano Gratuito", o consumo
   (vitrines, itens, vídeos, franquia) e os dois preços vindos do Stripe (R$ 149,90 e
   R$ 1.499,00, com a economia do anual). O link "Plano" aparece na navegação do painel.
2. **Checkout:** "Assinar por R$ 149,90 por mês" abre o Stripe em português, só com cartão.
   Pagar volta para o painel com "Assinatura confirmada".
3. **Assinatura no banco:** no Supabase, `subscriptions` tem `status = active`,
   `stripe_customer_id`, `stripe_subscription_id`, `interval = month` e `current_period_end`.
   No Stripe, o Customer tem `metadata.user_id` igual ao id do usuário.
4. **Pro na prática:** criar a 2ª e a 3ª vitrine; logo, cor da marca e banner deixam de ter
   cadeado; a marca d'água some da vitrine pública; o 11º item é aceito.
5. **Portal:** "Gerenciar assinatura" abre o Customer Portal; cancelar no fim do período
   mostra "Cancelamento agendado: o Pro vale até DD/MM/AAAA" no painel.
6. **Falha de pagamento (modo de teste):** trocar o cartão para `4000 0000 0000 0341` e
   forçar uma cobrança; o painel mostra "Não conseguimos cobrar seu cartão. Atualize o
   pagamento até DD/MM/AAAA" e o Pro continua valendo (carência de 7 dias).
7. **Cancelamento:** cancelar agora pelo portal (ou `stripe subscriptions cancel`) e conferir:
   plano volta a Gratuito, a tela pede "Escolha qual vitrine fica ativa", as outras vitrines
   mostram "Vitrine indisponível no momento", a marca d'água volta e os itens acima de 10
   somem da vitrine (nada é apagado).
8. **Escolha da vitrine ativa:** escolher a segunda vitrine e conferir que ela volta ao ar e a
   primeira congela.
9. **Reassinar:** assinar de novo e conferir que tudo volta sozinho — vitrines, itens, vídeos,
   logo e banner — sem refazer nada.
10. **Webhook:** em Desenvolvedores → Webhooks, todos os eventos com resposta 200. Reenviar um
    evento já entregue deve responder `{"duplicated":true}`.
11. **Tarefa diária:** `curl -H "Authorization: Bearer $CRON_SECRET" https://app.agenn.com.br/api/cron/diaria`
    responde 200 com `subscriptions`, `videoWarnings` e `videosDeleted`. Sem o segredo, 401.

## O que não dá para conferir à mão hoje

A regra dos 90 dias e o aviso do dia 83 dependem de uma conta que saiu do Pro há muito tempo.
Estão cobertos por testes automatizados (pgTAP e Playwright, com datas forjadas). Em produção,
a primeira ocasião real aparece 83 dias depois do primeiro cancelamento — vale conferir o
`videoWarnings` da tarefa diária nesse dia.

## Pendências registradas

- Excluir conta (cancelar no Stripe e apagar dados e mídias) fica na Fase 6.
- Pix e boleto continuam fora do escopo (spec 13): só cartão.
- A regra dos 90 dias apaga **só vídeos** excedentes; itens acima de 10 nunca são apagados
  (spec 4.7), e o vídeo que o gratuito mostra também fica.
- O aviso do dia 83 depende de `EMAIL_DRIVER=resend` (configurado na Fase 3).
- Sem Stripe CLI no CI: a integração real é conferida por este roteiro.
- Cupons, promoções e troca de plano fora do Customer Portal não estão ligados.

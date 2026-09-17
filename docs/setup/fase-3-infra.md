# Fase 3 — Infraestrutura (vídeos)

Complementa `docs/setup/fase-2-infra.md`. Nenhum destes valores fica no código.

## 1. Biblioteca do Bunny Stream

1. **Stream → Add Video Library**
   - Nome: `agenn-vitrine-videos`
   - Replicação: só **São Paulo** (ou a região mais próxima oferecida)
   - Rede: **Volume**
2. **Encoding**
   - Resoluções: **240p, 360p, 480p e 720p** (desmarcar 1080p, 1440p e 2160p)
   - **Keep original files:** desligado
   - **MP4 fallback:** desligado
3. **Security**
   - **Allowed referrers:** `*.agenn.com.br` e `agenn.com.br`
   - **Block direct URL file access:** ligado
   - **Token authentication:** desligado nesta fase
4. **API**: anotar **Library ID**, **API Key** e **Read-Only API Key**. Em **Webhook URL**: `https://app.agenn.com.br/api/webhooks/bunny`.
5. Anotar o **CDN Hostname** da biblioteca (ex.: `vz-1a2b3c4d-5e6.b-cdn.net`).
6. **Account → Billing**: conferir que o alerta de gasto cobre também o Stream.

O webhook do Bunny envia `{ VideoLibraryId, VideoGuid, Status }` com o cabeçalho `X-BunnyStream-Signature` (HMAC-SHA256 do corpo, chave = Read-Only API Key). O sistema confere a assinatura e consulta o vídeo na API antes de atualizar o status.

## 2. Variáveis na Vercel (`agenn-vitrine-v1`, Production)

| Key | Value | Type |
|---|---|---|
| `VIDEO_STREAM_DRIVER` | `bunny` | Config |
| `BUNNY_STREAM_LIBRARY_ID` | Library ID | Config |
| `BUNNY_STREAM_API_KEY` | API Key | Secret |
| `BUNNY_STREAM_WEBHOOK_SECRET` | Read-Only API Key | Secret |
| `NEXT_PUBLIC_VIDEO_CDN_BASE_URL` | `https://<CDN Hostname>` (sem barra final) | Config |
| `CRON_SECRET` | valor aleatório de 64+ caracteres | Secret |

Gerar o `CRON_SECRET` com `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`. Marcar sempre **Production** e fazer redeploy (ou merge) depois de criar.

## 3. Vercel Cron

- Rota: `/api/cron/diaria`, todos os dias às 07:00 UTC (04:00 em São Paulo), definida em `vercel.json`.
- A Vercel envia `Authorization: Bearer <CRON_SECRET>`; sem o cabeçalho certo a rota responde 401.
- No plano Hobby o cron roda uma vez por dia e o minuto exato pode variar.
- Faz: apaga mídias com falha ou paradas há mais de 24 h e envios de item nunca salvos (no banco, no Storage e no Stream); apaga pedidos expirados e limites de requisição antigos; revalida as vitrines de quem estourou a franquia no mês anterior.

## 4. Consumo de vídeo

A API do Bunny Stream não informa banda por vídeo (só visualizações e tempo assistido; banda só no total da biblioteca). Por isso o player da vitrine mede os bytes baixados (hls.js) ou estima pelo tempo assistido (HLS nativo do Safari) e envia a `POST /api/video-usage`. O servidor limita cada relatório a 1,5 × 4 Mbps por segundo e soma em `video_usage_monthly` (mês civil em São Paulo). Ao passar de 1024 GB, as vitrines do dono mostram só as capas até o mês virar.

## 5. Resend (e-mail de franquia)

1. Criar conta em resend.com (se ainda não existir).
2. **Domains → Add Domain**: `agenn.com.br`, região **São Paulo (sa-east-1)**.
3. Criar no **Cloudflare → DNS** os registros que o Resend mostrar (DKIM em `resend._domainkey`, MX e TXT de SPF no subdomínio `send`), com **Proxy status: DNS only**. Clicar **Verify** no Resend e esperar **Verified**.
4. **API Keys → Create API Key**: nome `agenn-vitrine-producao`, permissão **Sending access**, domínio `agenn.com.br`.
5. Na Vercel (Production):

| Key | Value | Type |
|---|---|---|
| `EMAIL_DRIVER` | `resend` | Config |
| `RESEND_API_KEY` | chave `re_…` | Secret |
| `EMAIL_FROM` | `Agenn Vitrine <nao-responda@agenn.com.br>` | Config |

6. (Recomendado) **Supabase → Authentication → SMTP** com o SMTP do Resend: host `smtp.resend.com`, porta `465`, usuário `resend`, senha = uma API key do Resend, remetente `nao-responda@agenn.com.br`.

O aviso sai uma vez por dono por mês, quando a franquia estoura, com o assunto "A franquia de vídeo deste mês acabou". Sem `EMAIL_DRIVER=resend`, nenhum e-mail é enviado (o aviso continua no painel).

## 6. Conferência em produção

1. Enviar um vídeo vertical de celular (até 60 s) num item: ver "Enviando… N%", "Processando o vídeo…" e "Vídeo pronto".
2. Derrubar o Wi-Fi no meio de um envio grande e religar: aparece "Conexão caiu, retomando…" e o envio continua.
3. Tentar um vídeo de 70 s: recusado antes do envio com o motivo.
4. Na vitrine pelo celular (4G): listagem sem vídeo; abrir o item toca sem som em loop; "Ativar som"; fechar interrompe o download.
5. No iPhone (Safari): o vídeo toca pelo HLS nativo.
6. Conta Pro: banner em vídeo horizontal; com "Reduzir movimento" ligado no sistema, fica só a imagem.
7. No Supabase dev, `video_usage_monthly` do dono soma bytes; em Minhas vitrines, "Franquia do mês" mostra o valor.
8. Excluir o item com vídeo: o vídeo some da biblioteca do Bunny Stream.
9. Vercel → Settings → Cron Jobs → Run: resposta 200 com o resumo.
10. E-mail de franquia: com uma conta de teste, pôr `video_usage_monthly.bytes_delivered` do mês em `1099511627000`, abrir um item com vídeo por alguns segundos; chega "A franquia de vídeo deste mês acabou" (conferir em Resend → Emails) e a vitrine mostra só fotos. Depois voltar `bytes_delivered` para `0` e `over_quota` para `false`.

**Situação em 2026-09-17:** o envio chega ao Bunny, mas a conversão fica em "Processing" também para vídeos enviados direto pelo painel do Bunny. Chamado aberto no suporte do Bunny. Os itens 1 a 8 e 10 dependem da conversão funcionar.

## 7. Pendências registradas

- Conversão travada no Bunny Stream (chamado aberto).
- Regra dos 90 dias após sair do Pro e aviso no dia 83; conferência diária com o Stripe → Fase 5.
- Duplicar item não copia o vídeo.
- Envio de vídeo abandonado ocupa a vaga do plano até a limpeza diária (até 24 h).
- Verificações de endereço e código do item ainda são server actions com atraso ("Failed to find Server Action" no log ao trocar de página).
- Fase de design dedicada (visual do painel e da vitrine).

## 8. Riscos aceitos

- Os bytes relatados pelo navegador podem ser manipulados dentro do teto por segundo.
- Envio de vídeo abandonado ocupa a vaga do plano até a limpeza diária (até 24 h).
- Duplicar item não copia o vídeo.
- Regra dos 90 dias após sair do Pro e conferência do Stripe ficam para a Fase 5.

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

## 5. Riscos aceitos

- Os bytes relatados pelo navegador podem ser manipulados dentro do teto por segundo.
- Envio de vídeo abandonado ocupa a vaga do plano até a limpeza diária (até 24 h).
- Duplicar item não copia o vídeo.
- Regra dos 90 dias após sair do Pro e conferência do Stripe ficam para a Fase 5.

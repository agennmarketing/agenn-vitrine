import { expect, test } from '@playwright/test'

// O envio de vídeo saiu do painel; o webhook continua no ar para os vídeos que já existem.
test('webhook do Mux: assinatura inválida é recusada', async ({ request }) => {
  const bad = await request.post('/api/webhooks/mux', {
    data: '{"type":"video.asset.ready","data":{"id":"x"}}',
    headers: {
      'content-type': 'application/json',
      'mux-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
    },
  })
  expect(bad.status()).toBe(401)
})

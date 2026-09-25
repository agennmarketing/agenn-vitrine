/*
 * Service worker do Agenn, servido na raiz de cada host: o painel em app.agenn.com.br e
 * cada vitrine no seu subdomínio. Como a origem muda, cada um tem o seu próprio cache.
 *
 * A estratégia é curta de propósito:
 * - abrir ou recarregar uma página vai sempre à rede. Sem sinal, mostra a tela "Sem
 *   conexão" daqui. HTML não é guardado: as páginas do painel trazem dados da conta e a
 *   vitrine muda de preço.
 * - arquivos do build (/_next/static), imagens e fontes vêm do cache primeiro: têm hash
 *   no nome, então o conteúdo nunca muda.
 * - responder à navegação mesmo offline é também o que faz o navegador oferecer
 *   "Instalar aplicativo".
 */
const CACHE = 'agenn-estatico-v1'

// Em desenvolvimento nada é guardado: os arquivos de /_next/ mudam a cada recompilação e
// um cache antigo quebraria a página.
const DEV = self.location.hostname === 'localhost' || self.location.hostname.endsWith('.localhost')

const OFFLINE_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão</title>
<style>
  :root { color-scheme: light dark; --fundo: #f7f6fb; --texto: #17122b; --fraco: #5e5873; --borda: #ccc5df; }
  @media (prefers-color-scheme: dark) { :root { --fundo: #0f0f11; --texto: #f4f4f2; --fraco: #a9a9b2; --borda: #404047; } }
  body { margin: 0; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; padding: 2rem 1.5rem; text-align: center; background: var(--fundo); color: var(--texto);
    font-family: system-ui, -apple-system, sans-serif; }
  h1 { margin: 0; font-size: 1.375rem; letter-spacing: -0.02em; }
  p { margin: 0; max-width: 22rem; color: var(--fraco); line-height: 1.5; }
  button { margin-top: 0.75rem; min-height: 3rem; padding: 0 1.5rem; border: 2px solid var(--borda); border-radius: 999px;
    background: transparent; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <h1>Sem conexão</h1>
  <p>Você está offline. Assim que a internet voltar, é só tentar de novo.</p>
  <button type="button" onclick="location.reload()">Tentar de novo</button>
</body>
</html>`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

function offline() {
  return new Response(OFFLINE_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

async function fromCache(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  // Resposta opaca (mídia de outro domínio) não diz se deu certo: não vale guardar.
  if (response.ok && response.type !== 'opaque') cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(offline))
    return
  }

  if (DEV) return
  const url = new URL(request.url)
  const cacheable =
    (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) ||
    request.destination === 'image' ||
    request.destination === 'font'
  if (cacheable) event.respondWith(fromCache(request))
})

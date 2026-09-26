import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache'

/*
 * Publicação no Cloudflare Workers (adaptador OpenNext). A Vercel não usa este
 * arquivo: lá continua valendo o build padrão do Next.
 *
 * As duas peças de cache existem por um motivo concreto:
 * - incremental cache (R2): guarda as páginas geradas da vitrine pública.
 * - tag cache (D1): é o que faz `revalidateTag` valer. A vitrine pública é gerada
 *   com `unstable_cache` marcado por vitrine, e o painel chama revalidateVitrine()
 *   a cada alteração. Sem o tag cache, a vitrine ficaria mostrando o conteúdo
 *   antigo depois de uma edição.
 */
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
})

'use client'

import { useEffect } from 'react'

// Tira parâmetros de aviso (?salvo=1, ?criada=1) da URL depois de exibidos, para que
// recarregar ou voltar não repita a mensagem. replaceState não refaz a página no Next.
export function ClearSearchParams({ keys }: { keys: string[] }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    let changed = false
    for (const key of keys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [keys])
  return null
}

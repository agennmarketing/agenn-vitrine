'use client'

import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

// Lê ?item= do endereço. useSearchParams faria o catálogo inteiro renderizar só no
// navegador (use-search-params.md); aqui a página continua estática.
export function useItemParam() {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '')
  const itemCode = new URLSearchParams(search).get('item')

  const navigate = useCallback((code: string | null) => {
    const url = new URL(window.location.href)
    if (code) url.searchParams.set('item', code)
    else url.searchParams.delete('item')
    window.history.pushState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return {
    itemCode,
    openItem: useCallback((code: string) => navigate(code), [navigate]),
    closeItem: useCallback(() => navigate(null), [navigate]),
  }
}

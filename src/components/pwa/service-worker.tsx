'use client'

import { useEffect } from 'react'

/*
 * Registra o service worker (`public/sw.js`, servido na raiz de cada host). Sem ele o
 * navegador não oferece "Instalar aplicativo" — e é ele que mostra a tela "Sem conexão".
 * Só depois do carregamento, para não disputar banda com a primeira tela.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const register = () => {
      // Falha de registro (modo privado, política do navegador) não pode quebrar a página.
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}

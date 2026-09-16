'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'
import { env } from '@/lib/env'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      'response-field-name': 'captchaToken',
      appearance: 'interaction-only',
      language: 'pt-br',
    })
  }, [siteKey])

  useEffect(() => {
    renderWidget()
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [renderWidget])

  // O token é de uso único: renova depois de cada envio do formulário.
  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current)
  }, [resetSignal])

  if (!siteKey) return null
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
    </>
  )
}

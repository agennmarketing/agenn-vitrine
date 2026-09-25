'use client'

import { useSyncExternalStore } from 'react'

// Evento do Chrome/Edge que guarda o convite de instalação para o momento do toque.
type InstallPromptEvent = Event & { prompt: () => Promise<void> }

/*
 * Estado do convite de instalação, guardado fora do React (como a sacola da vitrine):
 * o navegador dispara `beforeinstallprompt` uma vez só, às vezes antes de a tela montar,
 * e assim o convite não se perde. Três situações:
 * - 'convite': o navegador deixa instalar na hora (Chrome, Edge, Android).
 * - 'guia': iPhone/iPad, onde o caminho é Compartilhar → Adicionar à Tela de Início.
 * - 'oculto': já instalado, ou navegador que não instala nada.
 */
type InstallState = 'oculto' | 'convite' | 'guia'

let promptEvent: InstallPromptEvent | null = null
let installed = false
let apple = false
let started = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// O iPad se apresenta como Mac desde o iPadOS 13, daí a checagem de toque.
function needsAppleGuide() {
  const iPadComoMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadComoMac
}

function start() {
  if (started) return
  started = true
  installed = isInstalled()
  apple = needsAppleGuide()
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptEvent = event as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    installed = true
    emit()
  })
  // Instalou e o navegador abriu o aplicativo nesta mesma aba: o convite sai da tela.
  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    installed = isInstalled()
    emit()
  })
}

if (typeof window !== 'undefined') start()

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): InstallState {
  if (installed) return 'oculto'
  if (promptEvent) return 'convite'
  return apple ? 'guia' : 'oculto'
}

// No servidor nada aparece: só o navegador sabe se dá para instalar.
const serverSnapshot = (): InstallState => 'oculto'

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot)

  return {
    canInstall: state === 'convite',
    needsGuide: state === 'guia',
    async install() {
      const event = promptEvent
      if (!event) return
      // O navegador entrega o convite uma vez só: depois de usar, o botão sai.
      promptEvent = null
      emit()
      await event.prompt()
    },
  }
}

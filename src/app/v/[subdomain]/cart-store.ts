'use client'

import { useSyncExternalStore } from 'react'
import { cartStorageKey, parseStoredCart, serializeCart, type CartLine } from '@/lib/cart/cart'

type CartStore = {
  get: () => CartLine[]
  set: (lines: CartLine[]) => void
  subscribe: (listener: () => void) => () => void
}

const EMPTY: CartLine[] = []
const stores = new Map<string, CartStore>()

// Spec 7.4: localStorage por vitrine, sempre em try/catch; sem armazenamento, só em memória.
function createStore(vitrineId: string): CartStore {
  const key = cartStorageKey(vitrineId)
  let lines: CartLine[] | null = null
  const listeners = new Set<() => void>()

  const read = () => {
    try {
      return parseStoredCart(window.localStorage.getItem(key))
    } catch {
      return []
    }
  }

  return {
    get() {
      if (lines === null) lines = read()
      return lines
    },
    set(next) {
      lines = next
      try {
        window.localStorage.setItem(key, serializeCart(next))
      } catch {
        // Sem armazenamento (modo privado, cota): segue só em memória.
      }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return
        lines = read()
        listener()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}

function storeFor(vitrineId: string): CartStore {
  let store = stores.get(vitrineId)
  if (!store) {
    store = createStore(vitrineId)
    stores.set(vitrineId, store)
  }
  return store
}

export function useCart(vitrineId: string) {
  const store = storeFor(vitrineId)
  const lines = useSyncExternalStore(store.subscribe, store.get, () => EMPTY)
  return { lines, setLines: store.set }
}

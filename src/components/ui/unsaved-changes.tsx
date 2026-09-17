'use client'

import { useEffect } from 'react'

// Pede confirmação do navegador ao sair com alterações não salvas no formulário.
export function UnsavedChangesGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return
    let dirty = false
    const markDirty = () => {
      dirty = true
    }
    const clear = () => {
      dirty = false
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    form.addEventListener('input', markDirty)
    form.addEventListener('submit', clear)
    window.addEventListener('beforeunload', warn)
    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('submit', clear)
      window.removeEventListener('beforeunload', warn)
    }
  }, [formId])
  return null
}

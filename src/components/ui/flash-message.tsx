'use client'

import { CircleCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Aviso de sucesso passageiro: some sozinho depois de `duration` ms ou no X.
export function FlashMessage({ message, duration = 3000 }: { message: string; duration?: number }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!open) return null
  return (
    <p
      role="status"
      className="flex animate-rise items-center gap-2.5 rounded-control border-2 border-success/30 bg-success-soft py-2 pl-4 pr-2 text-[0.9375rem] font-bold leading-5 text-success"
    >
      <CircleCheck aria-hidden="true" className="size-5 shrink-0 animate-pop" strokeWidth={2.5} />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Fechar aviso"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-success transition-colors hover:bg-success/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-success"
      >
        <X aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.75} />
      </button>
    </p>
  )
}

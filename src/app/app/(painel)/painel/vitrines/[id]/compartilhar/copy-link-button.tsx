'use client'

import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'
import { Button, type ButtonSize } from '@/components/ui/button'

export function CopyLinkButton({ url, className = '', size }: { url: string; className?: string; size?: ButtonSize }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={copied ? 'secondary' : 'primary'}
      size={size}
      className={`${className} ${copied ? 'border-success bg-success-soft text-success' : ''}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          window.prompt('Copie o link:', url)
        }
      }}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-[1.125rem] animate-pop" strokeWidth={3} />
      ) : (
        <Link2 aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.5} />
      )}
      <span aria-live="polite">{copied ? 'Link copiado' : 'Copiar link'}</span>
    </Button>
  )
}

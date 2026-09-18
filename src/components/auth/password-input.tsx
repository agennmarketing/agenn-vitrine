'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'

/*
 * Campo de senha com botão de mostrar/ocultar.
 * O nome acessível do botão ("Mostrar senha") não coincide com nenhum rótulo de campo
 * ("Senha", "Nova senha", "Senha atual"…): a busca por rótulo continua achando só o campo.
 */
export function PasswordInput({
  invalid,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} invalid={invalid} className={`pr-14 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-ink-muted transition-colors hover:text-ink"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-5" strokeWidth={2.5} />
        ) : (
          <Eye aria-hidden="true" className="size-5" strokeWidth={2.5} />
        )}
      </button>
    </div>
  )
}

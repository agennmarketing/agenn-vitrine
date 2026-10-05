'use client'

import type { ComponentProps } from 'react'
import { maskChange } from '@/lib/forms/mask-field'
import { MASKS, type MaskKind } from '@/lib/forms/masks'
import { Input } from './input'

// Teclado e preenchimento automático certos para cada máscara.
const FIELD_PROPS: Record<MaskKind, ComponentProps<'input'>> = {
  money: { inputMode: 'decimal' },
  phone: { type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  email: { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false },
}

// Input com máscara (valor em reais, telefone ou e-mail). O valor inicial já entra formatado.
export function MaskedInput({ mask, onChange, defaultValue, ...props }: ComponentProps<typeof Input> & { mask: MaskKind }) {
  return (
    <Input
      {...FIELD_PROPS[mask]}
      {...props}
      defaultValue={typeof defaultValue === 'string' ? MASKS[mask](defaultValue) : defaultValue}
      onChange={(event) => {
        maskChange(event, mask)
        onChange?.(event)
      }}
    />
  )
}

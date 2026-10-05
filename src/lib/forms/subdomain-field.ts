import { sanitizeSubdomainInput } from '@/lib/hosts/subdomain'

// Aplica o filtro no próprio campo (não controlado) e mantém o cursor onde a pessoa estava digitando.
export function filterSubdomainField(input: HTMLInputElement): string {
  const raw = input.value
  const clean = sanitizeSubdomainInput(raw)
  if (clean !== raw) {
    const caret = sanitizeSubdomainInput(raw.slice(0, input.selectionStart ?? raw.length)).length
    input.value = clean
    input.setSelectionRange(caret, caret)
  }
  return clean
}

import { MASKS, SIGNIFICANT, type MaskKind } from './masks'

const lastValue = new WeakMap<HTMLInputElement, string>()

function countSignificant(text: string, kind: MaskKind): number {
  let count = 0
  for (const char of text) if (SIGNIFICANT[kind].test(char)) count++
  return count
}

// Posição logo depois do n-ésimo caractere digitado (pulando a pontuação da máscara).
function caretAfter(text: string, n: number, kind: MaskKind): number {
  if (n === 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (SIGNIFICANT[kind].test(text[i]) && ++seen === n) return i + 1
  }
  return text.length
}

/*
 * Aplica a máscara no próprio campo (controlado ou não) e devolve o valor final.
 * O cursor fica depois do mesmo caractere digitado. Apagar só a pontuação ("-", ")")
 * não mudaria nada, então apaga o dígito anterior a ela.
 */
export function maskField(input: HTMLInputElement, kind: MaskKind, inputType?: string): string {
  const mask = MASKS[kind]
  let raw = input.value
  let caret = input.selectionStart ?? raw.length
  let masked = mask(raw)
  const previous = lastValue.get(input) ?? input.defaultValue
  if (inputType === 'deleteContentBackward' && masked === previous && caret > 0) {
    let i = caret - 1
    while (i >= 0 && !SIGNIFICANT[kind].test(raw[i])) i--
    if (i >= 0) {
      raw = raw.slice(0, i) + raw.slice(i + 1)
      caret = i
      masked = mask(raw)
    }
  }
  const typed = countSignificant(raw.slice(0, caret), kind)
  lastValue.set(input, masked)
  if (masked !== input.value) {
    input.value = masked
    // Digitando no fim (o caso comum), o cursor segue no fim.
    const position = caret >= raw.length ? masked.length : caretAfter(masked, typed, kind)
    // Campo fora de foco (preenchido por script) não aceita cursor em alguns navegadores.
    if (typeof document === 'undefined' || document.activeElement === input) input.setSelectionRange(position, position)
  }
  return masked
}

// Para o onChange do React: o tipo da edição vem do evento nativo.
export function maskChange(event: { currentTarget: HTMLInputElement; nativeEvent: Event }, kind: MaskKind): string {
  return maskField(event.currentTarget, kind, (event.nativeEvent as InputEvent).inputType)
}

export type FormState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

export const initialFormState: FormState = {}

export function fieldErrorsFromZod(error: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
}): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (key === undefined) continue
    const field = String(key)
    if (!result[field]) result[field] = issue.message
  }
  return result
}

export function readFormFields<const K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '')])) as Record<K, string>
}

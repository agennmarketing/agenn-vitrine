export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-control bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.25a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
        </svg>
        <span>{error}</span>
      </p>
    )
  }
  if (success) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-control bg-success-soft px-3.5 py-3 text-sm leading-5 text-success"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.03 4.72a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 0Z" />
        </svg>
        <span>{success}</span>
      </p>
    )
  }
  return null
}

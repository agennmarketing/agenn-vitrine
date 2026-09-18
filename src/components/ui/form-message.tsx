import { CircleAlert, CircleCheck } from 'lucide-react'

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="flex animate-rise items-start gap-2.5 rounded-control border-2 border-danger/25 bg-danger-soft px-4 py-3 text-[0.9375rem] font-bold leading-5 text-danger"
      >
        <CircleAlert aria-hidden="true" className="mt-px size-5 shrink-0" strokeWidth={2.5} />
        <span>{error}</span>
      </p>
    )
  }
  if (success) {
    return (
      <p
        role="status"
        className="flex animate-rise items-start gap-2.5 rounded-control border-2 border-go/40 bg-go-soft px-4 py-3 text-[0.9375rem] font-bold leading-5 text-go-strong"
      >
        <CircleCheck aria-hidden="true" className="mt-px size-5 shrink-0 animate-pop" strokeWidth={2.5} />
        <span>{success}</span>
      </p>
    )
  }
  return null
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
        {error}
      </p>
    )
  }
  if (success) {
    return (
      <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success">
        {success}
      </p>
    )
  }
  return null
}

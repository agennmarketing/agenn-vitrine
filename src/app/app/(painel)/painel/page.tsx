import { Card } from '@/components/ui/card'

export const metadata = { title: 'Minhas vitrines' }

export default function PainelHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Minhas vitrines</h1>
      <Card className="text-center">
        <h2 className="text-lg font-medium">Você ainda não tem vitrines</h2>
        <p className="mt-2 text-ink-muted">Em breve você poderá criar sua primeira vitrine por aqui.</p>
      </Card>
    </div>
  )
}

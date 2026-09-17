import { Simulator } from './simulator'

export const metadata = { title: 'Simulador' }

export default function SimuladorPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
      <Simulator />
    </div>
  )
}

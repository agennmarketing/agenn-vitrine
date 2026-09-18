import { PageHeader } from '@/components/ui/page-header'
import { Simulator } from './simulator'

export const metadata = { title: 'Simulador' }

export default function SimuladorPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Simulador" description="Confira um pedido que chegou no WhatsApp ou calcule um na hora." />
      <Simulator />
    </div>
  )
}

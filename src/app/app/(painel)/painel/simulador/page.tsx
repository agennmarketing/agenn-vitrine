import { PanelBody, PanelTopBar } from '@/components/ui/panel-page'
import { Simulator } from './simulator'

export const metadata = { title: 'Consultar Pedido' }

export default function SimuladorPage() {
  return (
    <>
      <PanelTopBar title="Consultar Pedido" subtitle="Confira um pedido que chegou no WhatsApp ou calcule um na hora." />
      <PanelBody>
        <Simulator />
      </PanelBody>
    </>
  )
}

import { getMyVitrine, getPanelSession } from '@/features/vitrines/queries'
import { MessagesForm } from './messages-form'

export const metadata = { title: 'Sacola e mensagens' }

export default async function MensagensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vitrine = await getMyVitrine(id)
  const { supabase } = await getPanelSession()
  const { data: checkout, error } = await supabase
    .from('checkout_settings')
    .select('name_mode, fulfillment_mode, payment_mode, schedule_mode, notes_mode, payment_options')
    .eq('vitrine_id', id)
    .single()
  if (error) throw error

  return (
    <MessagesForm
      vitrineId={id}
      initial={{
        cartEnabled: vitrine.cart_enabled ? 'on' : '',
        cartButtonText: vitrine.cart_button_text,
        defaultButtonText: vitrine.default_button_text,
        nameMode: checkout.name_mode,
        fulfillmentMode: checkout.fulfillment_mode,
        paymentMode: checkout.payment_mode,
        scheduleMode: checkout.schedule_mode,
        notesMode: checkout.notes_mode,
        paymentOptions: checkout.payment_options.join('\n'),
      }}
    />
  )
}

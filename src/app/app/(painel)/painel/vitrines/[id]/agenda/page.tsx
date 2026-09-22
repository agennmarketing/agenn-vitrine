import { redirect } from 'next/navigation'

// A Agenda saiu das abas da vitrine e virou item da barra lateral.
export default function OldAgendaPage() {
  redirect('/painel/agenda')
}

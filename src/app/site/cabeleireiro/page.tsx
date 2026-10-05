import { permanentRedirect } from 'next/navigation'

// Endereço antigo da página de cabeleireira: quem guardou ou divulgou o link cai na página nova.
export default function CabeleireiroPage() {
  permanentRedirect('/cabeleireira')
}

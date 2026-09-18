import { LegalDocument } from '@/components/legal/legal-document'
import { LEGAL_VERSION_LABEL } from '@/lib/legal/company'
import { PRIVACY } from '@/lib/legal/privacy'

export const metadata = { title: 'Política de privacidade' }

export default function PrivacidadePage() {
  return <LegalDocument title="Política de privacidade" updatedAt={LEGAL_VERSION_LABEL} sections={PRIVACY} />
}

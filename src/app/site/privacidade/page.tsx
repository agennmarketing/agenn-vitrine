import { LEGAL_VERSION_LABEL } from '@/lib/legal/company'
import { PRIVACY } from '@/lib/legal/privacy'
import { LegalDocument } from '../legal-document'

export const metadata = { title: 'Política de privacidade' }

export default function PrivacidadePage() {
  return <LegalDocument title="Política de privacidade" updatedAt={LEGAL_VERSION_LABEL} sections={PRIVACY} />
}

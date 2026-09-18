import { LEGAL_VERSION_LABEL } from '@/lib/legal/company'
import { TERMS } from '@/lib/legal/terms'
import { LegalDocument } from '../legal-document'

export const metadata = { title: 'Termos de uso' }

export default function TermosPage() {
  return <LegalDocument title="Termos de uso" updatedAt={LEGAL_VERSION_LABEL} sections={TERMS} />
}

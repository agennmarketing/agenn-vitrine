import { notFound } from 'next/navigation'

// A vitrine pública é construída na Fase 2. Até lá, todo subdomínio responde 404.
export default function VitrinePage() {
  notFound()
}

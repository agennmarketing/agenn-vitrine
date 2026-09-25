import { painelManifest } from '@/lib/pwa/manifest'

// Manifesto do aplicativo do profissional (painel). Fixo: não depende de conta nem de sessão.
export async function GET() {
  return new Response(JSON.stringify(painelManifest()), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  })
}

import { robotsTxt } from '@/lib/public/robots'

// O painel e as telas de acesso nunca são indexados.
export async function GET() {
  return new Response(robotsTxt({ allow: false }), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

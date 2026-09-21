import { NextResponse } from 'next/server'
import { getVideoServiceEnv } from '@/lib/server-env'
import { markFakeUploaded } from '@/lib/video/fake-video'

// Só CI e desenvolvimento: recebe o arquivo (descartado) e marca o "vídeo" como codificado.
// O webhook continua sendo chamado à parte (nos testes), como faria o Mux.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getVideoServiceEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })
  const { id } = await params
  await request.arrayBuffer()
  const found = await markFakeUploaded(id).catch(() => false)
  return new NextResponse(null, { status: found ? 204 : 404 })
}

import { NextResponse } from 'next/server'
import { getVideoStreamEnv } from '@/lib/server-env'
import { markFakeUploaded } from '@/lib/video/fake-stream'

// Só CI e desenvolvimento: recebe o arquivo (descartado) e marca o "vídeo" como codificado.
// O webhook continua sendo chamado à parte (nos testes), como faria o Bunny.
export async function PUT(request: Request, { params }: { params: Promise<{ guid: string }> }) {
  if (getVideoStreamEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })
  const { guid } = await params
  await request.arrayBuffer()
  const found = await markFakeUploaded(guid).catch(() => false)
  return new NextResponse(null, { status: found ? 204 : 404 })
}

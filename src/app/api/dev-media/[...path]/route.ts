import { NextResponse } from 'next/server'
import { getMediaStorageEnv } from '@/lib/server-env'
import { createFakeStorage } from '@/lib/media/fake-storage'

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (getMediaStorageEnv().driver !== 'fake') return new NextResponse(null, { status: 404 })
  const { path } = await params
  const relative = path.join('/')
  let bytes: Uint8Array | null = null
  try {
    bytes = await createFakeStorage().get(relative)
  } catch {
    bytes = null
  }
  if (!bytes) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': relative.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

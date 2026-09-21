import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { videoPlaylistUrl, videoThumbnailUrl } from './urls'
import type { VideoInfo, VideoService } from './video-service'

// Só CI e desenvolvimento: "vídeos" são arquivos JSON no diretório temporário.
// Um único id faz as vezes de upload, asset e playback.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-video')
const BASE = '/api/dev-video'
const ID = /^[0-9a-f-]{36}$/

function fileFor(id: string) {
  if (!ID.test(id)) throw new Error('id inválido')
  return path.join(ROOT, `${id}.json`)
}

async function read(id: string): Promise<VideoInfo | null> {
  try {
    return JSON.parse(await readFile(fileFor(id), 'utf8')) as VideoInfo
  } catch {
    return null
  }
}

async function write(video: VideoInfo) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(fileFor(video.assetId!), JSON.stringify(video))
}

export async function markFakeUploaded(id: string): Promise<boolean> {
  const video = await read(id)
  if (!video) return false
  await write({ ...video, status: 'ready', playbackId: id })
  return true
}

export function createFakeVideoService(): VideoService {
  return {
    async upload({ durationSeconds, width, height }) {
      const id = crypto.randomUUID()
      await write({
        assetId: id,
        playbackId: null,
        status: 'processing',
        durationSeconds: Math.round(durationSeconds),
        width,
        height,
      })
      return { uploadId: id, url: `${BASE}/upload/${id}` }
    },
    status: ({ uploadId, assetId }) => read(assetId ?? uploadId ?? ''),
    async delete(assetId) {
      await rm(fileFor(assetId), { force: true })
    },
    playbackUrl: (playbackId) => videoPlaylistUrl(BASE, playbackId),
    thumbnail: (playbackId) => videoThumbnailUrl(BASE, playbackId),
  }
}

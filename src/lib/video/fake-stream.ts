import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { StreamVideo, VideoStream } from './stream'

// Só CI e desenvolvimento: "vídeos" são arquivos JSON no diretório temporário.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-video')
const GUID = /^[0-9a-f-]{36}$/

function fileFor(guid: string) {
  if (!GUID.test(guid)) throw new Error('guid inválido')
  return path.join(ROOT, `${guid}.json`)
}

async function read(guid: string): Promise<StreamVideo | null> {
  try {
    return JSON.parse(await readFile(fileFor(guid), 'utf8')) as StreamVideo
  } catch {
    return null
  }
}

async function write(video: StreamVideo) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(fileFor(video.guid), JSON.stringify(video))
}

export async function markFakeUploaded(guid: string): Promise<boolean> {
  const video = await read(guid)
  if (!video) return false
  await write({ ...video, status: 3 })
  return true
}

export function createFakeStream(): VideoStream {
  return {
    async createVideo(_title, declared) {
      const guid = crypto.randomUUID()
      await write({
        guid,
        status: 0,
        length: Math.round(declared.durationSeconds),
        width: declared.width,
        height: declared.height,
      })
      return guid
    },
    uploadTicket(guid) {
      return { mode: 'put', url: `/api/dev-video/upload/${guid}` }
    },
    getVideo: read,
    async deleteVideo(guid) {
      await rm(fileFor(guid), { force: true })
    },
  }
}

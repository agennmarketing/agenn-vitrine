import 'server-only'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { MediaStorage } from './storage'

// Só CI e desenvolvimento: grava no diretório temporário do sistema.
const ROOT = path.join(os.tmpdir(), 'agenn-vitrine-media')

export function resolveFakePath(relative: string): string {
  const full = path.resolve(ROOT, relative)
  if (!full.startsWith(ROOT + path.sep)) throw new Error('Caminho de mídia inválido')
  return full
}

export function createFakeStorage(): MediaStorage {
  return {
    async put(relative, body) {
      const full = resolveFakePath(relative)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, body)
    },
    async get(relative) {
      try {
        return new Uint8Array(await readFile(resolveFakePath(relative)))
      } catch {
        return null
      }
    },
    async remove(relative) {
      await rm(resolveFakePath(relative), { force: true })
    },
  }
}

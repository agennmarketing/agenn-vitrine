import 'server-only'
import type { MediaStorage } from './storage'

export function createBunnyStorage(config: { zone: string; password: string; host: string }): MediaStorage {
  const url = (path: string) => `https://${config.host}/${config.zone}/${path}`
  const headers = { AccessKey: config.password }
  return {
    async put(path, body, contentType) {
      const response = await fetch(url(path), {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': contentType },
        body: new Uint8Array(body),
      })
      if (!response.ok) throw new Error(`Bunny Storage PUT ${response.status} ${path}`)
    },
    async get(path) {
      const response = await fetch(url(path), { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Bunny Storage GET ${response.status} ${path}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    async remove(path) {
      const response = await fetch(url(path), { method: 'DELETE', headers })
      if (!response.ok && response.status !== 404) throw new Error(`Bunny Storage DELETE ${response.status} ${path}`)
    },
  }
}

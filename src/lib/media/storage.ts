import 'server-only'
import { getMediaStorageEnv } from '@/lib/server-env'
import { createBunnyStorage } from './bunny-storage'
import { createFakeStorage } from './fake-storage'

export interface MediaStorage {
  put(path: string, body: Uint8Array, contentType: string): Promise<void>
  get(path: string): Promise<Uint8Array | null>
  remove(path: string): Promise<void>
}

export function getMediaStorage(): MediaStorage {
  const config = getMediaStorageEnv()
  return config.driver === 'fake' ? createFakeStorage() : createBunnyStorage(config)
}

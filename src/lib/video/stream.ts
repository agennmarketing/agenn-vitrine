import 'server-only'
import { getVideoStreamEnv } from '@/lib/server-env'
import { createBunnyStream } from './bunny-stream'
import { createFakeStream } from './fake-stream'

export type StreamVideo = { guid: string; status: number; length: number; width: number; height: number }

export type UploadTicket =
  | { mode: 'tus'; endpoint: string; headers: Record<string, string> }
  | { mode: 'put'; url: string }

export interface VideoStream {
  createVideo(title: string, declared: { durationSeconds: number; width: number; height: number }): Promise<string>
  uploadTicket(guid: string): UploadTicket
  getVideo(guid: string): Promise<StreamVideo | null>
  deleteVideo(guid: string): Promise<void>
}

export function getVideoStream(): VideoStream {
  const config = getVideoStreamEnv()
  return config.driver === 'fake' ? createFakeStream() : createBunnyStream(config)
}

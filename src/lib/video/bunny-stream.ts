import 'server-only'
import { tusSignature } from './signatures'
import type { StreamVideo, VideoStream } from './stream'

const API = 'https://video.bunnycdn.com'
const TICKET_SECONDS = 6 * 60 * 60

export function createBunnyStream(config: { libraryId: string; apiKey: string }): VideoStream {
  const videos = `${API}/library/${config.libraryId}/videos`
  const headers = { AccessKey: config.apiKey, accept: 'application/json' }

  return {
    async createVideo(title) {
      const response = await fetch(videos, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!response.ok) throw new Error(`Bunny Stream POST ${response.status}`)
      const { guid } = (await response.json()) as { guid?: string }
      if (!guid) throw new Error('Bunny Stream não devolveu o guid')
      return guid
    },

    uploadTicket(guid) {
      const expires = Math.floor(Date.now() / 1000) + TICKET_SECONDS
      return {
        mode: 'tus',
        endpoint: `${API}/tusupload`,
        headers: {
          AuthorizationSignature: tusSignature({ libraryId: config.libraryId, apiKey: config.apiKey, expires, videoId: guid }),
          AuthorizationExpire: String(expires),
          VideoId: guid,
          LibraryId: config.libraryId,
        },
      }
    },

    async getVideo(guid) {
      const response = await fetch(`${videos}/${guid}`, { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Bunny Stream GET ${response.status}`)
      const video = (await response.json()) as StreamVideo
      return { guid: video.guid, status: video.status, length: video.length, width: video.width, height: video.height }
    },

    async deleteVideo(guid) {
      const response = await fetch(`${videos}/${guid}`, { method: 'DELETE', headers })
      if (!response.ok && response.status !== 404) throw new Error(`Bunny Stream DELETE ${response.status}`)
    },
  }
}

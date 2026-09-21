const trimBase = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

export function videoPlaylistUrl(baseUrl: string, playbackId: string): string {
  return `${trimBase(baseUrl)}/${playbackId}.m3u8`
}

export function videoThumbnailUrl(baseUrl: string, playbackId: string): string {
  return `${trimBase(baseUrl)}/${playbackId}/thumbnail.jpg`
}

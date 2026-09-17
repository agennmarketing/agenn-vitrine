const trimBase = (baseUrl: string) => baseUrl.replace(/\/+$/, '')

export function videoPlaylistUrl(baseUrl: string, guid: string): string {
  return `${trimBase(baseUrl)}/${guid}/playlist.m3u8`
}

export function videoThumbnailUrl(baseUrl: string, guid: string): string {
  return `${trimBase(baseUrl)}/${guid}/thumbnail.jpg`
}

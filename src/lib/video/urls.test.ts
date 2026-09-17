import { expect, it } from 'vitest'
import { videoPlaylistUrl, videoThumbnailUrl } from './urls'

it('URLs do Bunny Stream', () => {
  expect(videoPlaylistUrl('https://vz-1.b-cdn.net/', 'g1')).toBe('https://vz-1.b-cdn.net/g1/playlist.m3u8')
  expect(videoThumbnailUrl('/api/dev-video', 'g1')).toBe('/api/dev-video/g1/thumbnail.jpg')
})

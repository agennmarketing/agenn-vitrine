import { expect, it } from 'vitest'
import { videoPlaylistUrl, videoThumbnailUrl } from './urls'

it('URLs de reprodução e miniatura', () => {
  expect(videoPlaylistUrl('https://stream.mux.com/', 'pb1')).toBe('https://stream.mux.com/pb1.m3u8')
  expect(videoThumbnailUrl('https://image.mux.com', 'pb1')).toBe('https://image.mux.com/pb1/thumbnail.jpg')
  expect(videoPlaylistUrl('/api/dev-video', 'pb1')).toBe('/api/dev-video/pb1.m3u8')
})

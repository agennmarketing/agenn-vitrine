#!/usr/bin/env node
// Só para o CI: gera vídeos WebM (VP8) pequenos para os testes de envio.
// O Chromium do Playwright não decodifica H.264, mas lê duração e dimensões de WebM.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('e2e/fixtures', { recursive: true })

const fixtures = [
  { name: 'horizontal-3s', size: '640x360', seconds: 3 },
  { name: 'vertical-3s', size: '360x640', seconds: 3 },
  { name: 'longo-61s', size: '160x90', seconds: 61 },
]

for (const { name, size, seconds } of fixtures) {
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc=duration=${seconds}:size=${size}:rate=15`,
      '-c:v', 'libvpx', '-b:v', '100k',
      `e2e/fixtures/${name}.webm`,
    ],
    { stdio: 'inherit' },
  )
  console.log(`e2e/fixtures/${name}.webm`)
}

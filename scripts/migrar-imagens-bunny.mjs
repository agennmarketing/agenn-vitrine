#!/usr/bin/env node
// Copia, uma vez, as imagens que estão no Bunny para o bucket "media" do Supabase Storage.
// Lê cada arquivo pela URL pública antiga (a Pull Zone), então não precisa da senha do Bunny.
// Os caminhos não mudam: depois é só trocar NEXT_PUBLIC_MEDIA_BASE_URL.
//
// Uso:
//   BUNNY_PUBLIC_URL=https://agenn-vitrine-img.b-cdn.net \
//   NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co SUPABASE_SECRET_KEY=... \
//   node scripts/migrar-imagens-bunny.mjs
// Pode rodar mais de uma vez: o que já está no Supabase é pulado.
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'media'
const source = (process.env.BUNNY_PUBLIC_URL ?? '').replace(/\/+$/, '')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!source || !url || !key) {
  console.error('Defina BUNNY_PUBLIC_URL, NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const types = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }

async function allPaths() {
  const paths = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('media').select('storage_paths').not('storage_paths', 'is', null).range(from, from + 999)
    if (error) throw error
    for (const row of data) paths.push(...Object.values(row.storage_paths ?? {}).filter((p) => typeof p === 'string'))
    if (data.length < 1000) return paths
  }
}

async function exists(path) {
  const slash = path.lastIndexOf('/')
  const { data } = await supabase.storage.from(BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1) })
  return Boolean(data?.some((file) => file.name === path.slice(slash + 1)))
}

const paths = await allPaths()
console.log(`${paths.length} arquivos para conferir.`)
let copied = 0
let skipped = 0
const failed = []
for (const path of paths) {
  if (await exists(path)) {
    skipped++
    continue
  }
  const response = await fetch(`${source}/${path}`)
  if (!response.ok) {
    failed.push(`${path} (Bunny ${response.status})`)
    continue
  }
  const ext = path.split('.').pop().toLowerCase()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(await response.arrayBuffer()), { contentType: types[ext] ?? 'application/octet-stream', upsert: true, cacheControl: '31536000' })
  if (error) failed.push(`${path} (${error.message})`)
  else copied++
}
console.log(`Copiados: ${copied}. Já estavam lá: ${skipped}. Falharam: ${failed.length}.`)
for (const line of failed) console.log(`  - ${line}`)
process.exit(failed.length ? 1 : 0)

#!/usr/bin/env node
// Só para o GitHub Actions: lê as chaves do Supabase local do runner e grava o
// .env.local usado pelo `next build`, `next start` e Playwright. As variáveis
// fixas do CI (domínio, driver de mídia etc.) vêm do `env:` do workflow.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }))

function pick(...names) {
  for (const name of names) if (status[name]) return status[name]
  throw new Error(`Chave ausente no supabase status: ${names.join(' | ')}. Disponíveis: ${Object.keys(status).join(', ')}`)
}

const values = {
  NEXT_PUBLIC_SUPABASE_URL: pick('API_URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: pick('SECRET_KEY', 'SERVICE_ROLE_KEY'),
  MAILPIT_URL: pick('MAILPIT_URL', 'INBUCKET_URL'),
}

writeFileSync('.env.local', Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n')
console.log(`.env.local gravado com ${Object.keys(values).join(', ')}`)

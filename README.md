# Agenn Vitrine

SaaS para comerciantes criarem vitrines on-line (catálogo ou cardápio), cada uma no próprio subdomínio. Feito com Next.js e Supabase.

## Pré-requisitos

- Node.js 20.9 ou superior
- Docker Desktop em execução (para o Supabase local)

## Configuração

```bash
npm install
npx supabase start
```

Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` com as chaves exibidas por `npx supabase status`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:db` | Testes do banco (pgTAP) |
| `npm run test:e2e` | Testes ponta a ponta (Playwright) |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |

## Endereços locais

- Página inicial: http://localhost:3000
- Acesso e painel: http://app.localhost:3000

## Documentação

- Especificação: [docs/superpowers/specs](docs/superpowers/specs)
- Infraestrutura de produção: [docs/setup/fase-1-infra.md](docs/setup/fase-1-infra.md)

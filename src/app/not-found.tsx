// Sem next/font aqui de propósito: este arquivo entra na árvore de todas as rotas, e importar
// uma fonte nele faria a vitrine pública pré-carregar também a fonte do painel.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Página não encontrada</h1>
      <p className="text-ink-muted">Confira o endereço digitado.</p>
    </main>
  )
}

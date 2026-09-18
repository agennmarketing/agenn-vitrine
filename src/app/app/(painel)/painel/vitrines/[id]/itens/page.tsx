import { ItemsView } from './items-view'

export const metadata = { title: 'Itens' }

export default async function ItensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ salvo?: string; criada?: string }>
}) {
  const [{ id }, { salvo, criada }] = await Promise.all([params, searchParams])
  return <ItemsView id={id} salvo={salvo} criada={criada} />
}

import { FolderPlus } from 'lucide-react'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { getItemFormOptions } from '@/features/items/queries'
import { getMyVitrine, getVideoLimits } from '@/features/vitrines/queries'
import { ItemForm } from '../item-form'
import { ItemPageHeader } from '../item-page-header'

export const metadata = { title: 'Novo item' }

export default async function NovoItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [options, vitrine, videoLimits] = await Promise.all([getItemFormOptions(id), getMyVitrine(id), getVideoLimits()])

  if (options.categories.length === 0) {
    return (
      <section className="flex max-w-2xl flex-col items-center gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-card bg-go-soft text-go-strong shadow-[0_4px_0_var(--color-go)]"
        >
          <FolderPlus className="size-7" strokeWidth={2.5} />
        </span>
        <p className="max-w-sm text-lg font-extrabold text-ink">Crie uma categoria antes de cadastrar itens.</p>
        <Link href={`/painel/vitrines/${id}/itens`} className={buttonClasses('primary', 'w-full max-w-xs', 'lg')}>
          Voltar para os itens
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ItemPageHeader vitrineId={id} title="Novo item" />
      <ItemForm
        addonGroups={options.addonGroups}
        vitrineId={id}
        vitrineType={options.vitrine.type}
        defaultButtonText={vitrine.default_button_text}
        categories={options.categories}
        contacts={options.contacts}
        nextCode={options.nextCode}
        videoLimits={videoLimits}
      />
    </div>
  )
}

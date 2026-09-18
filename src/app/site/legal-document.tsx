import Link from 'next/link'
import type { LegalSection } from '@/lib/legal/terms'

export function LegalDocument({
  title,
  updatedAt,
  sections,
}: {
  title: string
  updatedAt: string
  sections: LegalSection[]
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline">
          Agenn Vitrine
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-muted">Última atualização: {updatedAt}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-ink-muted">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
